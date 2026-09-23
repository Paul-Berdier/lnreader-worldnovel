import { load } from 'cheerio';

// Applied only to a verified chapter body, never to an entire webpage.
export function sanitizeChapter(html: string): string {
  const $ = load(html, undefined, false);
  $('script,style,iframe,object,embed,form,input,button,select,textarea,link,meta,base,svg,math,nav,header,footer,aside,noscript,template').remove();
  $('[hidden],[aria-hidden="true"]').remove();
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i.test(style)) $(el).remove();
  });
  const allowed = new Set(['p','div','span','br','hr','em','strong','i','b','u','s','blockquote','ul','ol','li','h1','h2','h3','h4','ruby','rt','rp','sup','sub','img','a']);
  $('*').each((_, el) => {
    const node = $(el);
    if (!('attribs' in el) || !allowed.has(el.name)) { node.replaceWith(node.contents()); return; }
    for (const name of Object.keys(el.attribs)) {
      if (!['src','href','alt','title'].includes(name) || name === 'src' && el.name !== 'img' || name === 'href' && el.name !== 'a') { node.removeAttr(name); continue; }
      if ((name === 'src' || name === 'href') && !/^https:\/\//i.test((node.attr(name) || '').trim())) node.removeAttr(name);
    }
    if (el.name === 'img' && !node.attr('src')) node.remove();
  });
  if (!$.root().text().trim() && !$('img[src]').length) throw Error('WorldNovel : chapitre vide ou indisponible.');
  return $.root().html() || '';
}
