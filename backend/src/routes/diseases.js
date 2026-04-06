const express = require('express');
const axios = require('axios');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/diseases/search?q=
// ---------------------------------------------------------------------------
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = q.toLowerCase().trim();

    // 1. Check cache first
    const { data: cached } = await supabase
      .from('disease_cache')
      .select('results_json, expires_at')
      .eq('search_term', searchTerm)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      return res.json(cached.results_json);
    }

    // 2. Cache miss — call NLM MedlinePlus Connect API
    const nlmBase = process.env.NLM_API_BASE || 'https://connect.medlineplus.gov/service';
    let results = [];

    try {
      const apiUrl = `${nlmBase}?mainSearchCriteria.v.cs=2.16.840.1.113883.6.90&mainSearchCriteria.v.dn=${encodeURIComponent(q)}&knowledgeResponseType=application/json`;

      const response = await axios.get(apiUrl, { timeout: 10000 });
      const feed = response.data?.feed;

      if (feed && feed.entry) {
        const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
        results = entries.map((entry) => {
          const title = entry.title?._value || entry.title || '';
          const summary = entry.summary?._value || entry.summary || '';
          const links = entry.link || [];

          // Extract ICD code from links or title
          let icdCode = '';
          if (Array.isArray(links)) {
            const icdLink = links.find((l) => l.href && l.href.includes('icd'));
            if (icdLink) {
              const match = icdLink.href.match(/[A-Z]\d{2}(?:\.\d{1,3})?/);
              if (match) icdCode = match[0];
            }
          }

          return {
            name: title,
            icdCode,
            description: summary.substring(0, 500),
          };
        }).slice(0, 20);
      }
    } catch (apiError) {
      // External API failure — return empty array per spec
      logger.warn('NLM API call failed', { error: apiError.message, query: q });
      return res.json([]);
    }

    // 3. Cache the results
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabase
      .from('disease_cache')
      .upsert({
        search_term: searchTerm,
        results_json: results,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'search_term' });

    res.json(results);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
