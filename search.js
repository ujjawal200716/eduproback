import fetch from 'node-fetch';

// ===== MODULE: WEB SEARCH =====

/**
 * Performs a web search and returns summarized snippets
 * Uses DuckDuckGo Instant Answer API (free, no key required)
 */
export async function webSearch(query, maxResults = 3) {
  const startTime = Date.now();
  console.log(`[Search] Searching for: "${query}"`);
  
  try {
    // Use DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EduProAI/1.0' }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract relevant information
    const snippets = [];
    
    // Abstract (main answer)
    if (data.Abstract) {
      snippets.push(data.Abstract);
    }
    
    // Related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, maxResults).forEach(topic => {
        if (topic.Text) {
          snippets.push(topic.Text);
        }
      });
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Search] Completed in ${duration}s, found ${snippets.length} snippets`);
    
    if (snippets.length === 0) {
      return { 
        ok: true, 
        snippets: null,
        message: 'No search results found'
      };
    }
    
    // Join snippets into formatted text
    const formattedSnippets = snippets
      .filter(s => s && s.length > 20) // Filter out very short snippets
      .slice(0, maxResults)
      .map((snippet, idx) => `[${idx + 1}] ${snippet}`)
      .join('\n\n');
    
    return { 
      ok: true, 
      snippets: formattedSnippets 
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Search] Timeout');
      return { 
        ok: false, 
        error: 'Search timed out',
        snippets: null 
      };
    }
    
    console.error('[Search] Error:', error.message);
    return { 
      ok: false, 
      error: error.message,
      snippets: null 
    };
  }
}

// ===== MODULE: SEARCH HEALTH CHECK =====

export async function checkSearchHealth() {
  try {
    const result = await webSearch('test', 1);
    return { ok: result.ok };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ===== MODULE: ADVANCED SEARCH (fallback/future) =====

/**
 * Alternative search method using Wikipedia API
 * Useful as fallback or for educational queries
 */
export async function searchWikipedia(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error('Wikipedia API failed');
    }
    
    const data = await response.json();
    
    if (!data.query?.search || data.query.search.length === 0) {
      return { ok: true, snippets: null };
    }
    
    const snippets = data.query.search
      .map((result, idx) => `[${idx + 1}] ${result.title}: ${result.snippet.replace(/<[^>]*>/g, '')}`)
      .join('\n\n');
    
    return { ok: true, snippets };
    
  } catch (error) {
    console.error('[Search:Wiki] Error:', error.message);
    return { ok: false, error: error.message, snippets: null };
  }
}