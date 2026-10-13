import { Injectable, Logger } from '@nestjs/common';

const UA = 'Mozilla/5.0 (compatible; TonUp/1.0)';
const RATES_TTL = 5 * 60_000;
const GIFT_TTL = 10 * 60_000;
const SLUG = /^[a-z0-9]{2,40}-\d{1,9}$/;

export interface Rates {
  tonUsd: number;
  tonRub: number;
  /** Fragment buy price of one Telegram Star */
  starTon: number;
  starUsd: number;
  updatedAt: number;
  /** true when at least one source failed and an older / default value is used */
  stale: boolean;
}

/** Live TON / Stars rates and Telegram NFT-gift data (Fragment). Everything is cached; failures fall back to the last known value. */
@Injectable()
export class MarketService {
  private readonly log = new Logger('Market');
  private rates: Rates = { tonUsd: 1.37, tonRub: 115, starTon: 0.01092, starUsd: 0.015, updatedAt: 0, stale: true };
  private ratesPending: Promise<Rates> | null = null;
  private gifts = new Map<string, { at: number; v: any }>();
  private colls = new Map<string, { at: number; v: any }>();
  private lotties = new Map<string, { at: number; v: string }>();

  private async get(url: string, headers: Record<string, string> = {}): Promise<Response> {
    const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r;
  }

  private async tonPrice(): Promise<{ usd: number; rub: number }> {
    try {
      const j: any = await (await this.get('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,rub')).json();
      const p = j['the-open-network'];
      if (p?.usd > 0 && p?.rub > 0) return { usd: p.usd, rub: p.rub };
    } catch (e) { this.log.warn(`coingecko: ${e}`); }
    const j: any = await (await this.get('https://tonapi.io/v2/rates?tokens=ton&currencies=usd,rub')).json();
    const p = j.rates?.TON?.prices;
    if (!(p?.USD > 0 && p?.RUB > 0)) throw new Error('tonapi: bad response');
    return { usd: p.USD, rub: p.RUB };
  }

  /** Price of 1000 Stars on Fragment (buy side): TON and USD. */
  private async starsPrice(): Promise<{ ton: number; usd: number }> {
    const page = await this.get('https://fragment.com/stars/buy');
    const cookie = (page.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
    const hash = /"apiUrl":"\\\/api\?hash=([0-9a-f]+)"/.exec(await page.text())?.[1];
    if (!hash) throw new Error('fragment: api hash not found');
    const r = await fetch(`https://fragment.com/api?hash=${hash}`, {
      method: 'POST',
      headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', origin: 'https://fragment.com', referer: 'https://fragment.com/stars/buy', cookie },
      body: new URLSearchParams({ stars: '', quantity: '1000', method: 'updateStarsPrices' }),
      signal: AbortSignal.timeout(12_000),
    });
    const j: any = await r.json();
    const html: string = j.cur_price ?? '';
    const usd = /icon-usd">\s*([\d,.]+)/.exec(html)?.[1];
    const ton = /icon-ton">\s*([\d,]+)(?:<span class="mini-frac">(\.\d+)<\/span>)?/.exec(html);
    if (!usd || !ton) throw new Error('fragment: price not found');
    return { usd: parseFloat(usd.replace(/,/g, '')), ton: parseFloat(ton[1].replace(/,/g, '') + (ton[2] ?? '')) };
  }

  async getRates(): Promise<Rates> {
    if (Date.now() - this.rates.updatedAt < RATES_TTL) return this.rates;
    this.ratesPending ??= this.refresh().finally(() => { this.ratesPending = null; });
    return this.ratesPending;
  }

  private async refresh(): Promise<Rates> {
    const next = { ...this.rates };
    let failed = false;
    const [ton, stars] = await Promise.allSettled([this.tonPrice(), this.starsPrice()]);
    if (ton.status === 'fulfilled') { next.tonUsd = ton.value.usd; next.tonRub = ton.value.rub; } else { failed = true; this.log.warn(`ton price: ${ton.reason}`); }
    if (stars.status === 'fulfilled') { next.starTon = stars.value.ton / 1000; next.starUsd = stars.value.usd / 1000; } else { failed = true; this.log.warn(`stars price: ${stars.reason}`); }
    next.stale = failed;
    // retry sooner after a failure, but not on every request
    next.updatedAt = failed ? Date.now() - RATES_TTL + 30_000 : Date.now();
    this.rates = next;
    return next;
  }

  /** Cheapest listing and median of the last sales for a collection (TON). */
  private async collection(coll: string): Promise<{ floorTon: number | null; lastSoldTon: number | null }> {
    const hit = this.colls.get(coll);
    if (hit && Date.now() - hit.at < GIFT_TTL) return hit.v;
    const page = async (filter: string, sort: string) => {
      const html = await (await this.get(`https://fragment.com/gifts/${coll}?sort=${sort}&filter=${filter}`)).text();
      return html.split('class="tm-grid-item"').slice(1, 11).map((c) => {
        const m = /icon-ton">\s*([\d,]+)(?:<span class="mini-frac">(\.\d+)<\/span>)?/.exec(c);
        return m ? parseFloat(m[1].replace(/,/g, '') + (m[2] ?? '')) : NaN;
      }).filter((n) => n > 0);
    };
    const [sale, sold] = await Promise.all([page('sale', 'price_asc').catch(() => []), page('sold', 'listed').catch(() => [])]);
    const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const v = { floorTon: sale.length ? Math.min(...sale) : null, lastSoldTon: median(sold) };
    this.colls.set(coll, { at: Date.now(), v });
    return v;
  }

  private conv(ton: number | null, r: Rates) {
    if (ton == null) return null;
    return { ton, usd: ton * r.tonUsd, rub: ton * r.tonRub, stars: Math.round(ton / r.starTon) };
  }

  /** NFT gift: attributes, animation links and an approximate price (collection floor + median of recent sales). */
  async getGift(slug: string) {
    slug = slug.toLowerCase();
    if (!SLUG.test(slug)) throw new Error('bad slug');
    const hit = this.gifts.get(slug);
    if (hit && Date.now() - hit.at < GIFT_TTL) return hit.v;
    const meta: any = await (await this.get(`https://nft.fragment.com/gift/${slug}.json`)).json();
    const attr = (t: string) => meta.attributes?.find((a: any) => a.trait_type === t)?.value ?? null;
    const coll = slug.replace(/-\d+$/, '');
    const [rates, c] = await Promise.all([this.getRates(), this.collection(coll).catch(() => ({ floorTon: null, lastSoldTon: null }))]);
    const v = {
      slug, collection: coll, name: meta.name, description: meta.description,
      model: attr('Model'), backdrop: attr('Backdrop'), symbol: attr('Symbol'),
      image: `https://nft.fragment.com/gift/${slug}.webp`,
      lottie: `/market/gift/${slug}/lottie`,
      floor: this.conv(c.floorTon, rates), lastSold: this.conv(c.lastSoldTon, rates),
      approx: true, stale: rates.stale, updatedAt: Date.now(),
    };
    this.gifts.set(slug, { at: Date.now(), v });
    return v;
  }

  async getLottie(slug: string): Promise<string> {
    slug = slug.toLowerCase();
    if (!SLUG.test(slug)) throw new Error('bad slug');
    const hit = this.lotties.get(slug);
    if (hit && Date.now() - hit.at < 3_600_000) return hit.v;
    const v = await (await this.get(`https://nft.fragment.com/gift/${slug}.lottie.json`)).text();
    if (this.lotties.size > 60) this.lotties.clear();
    this.lotties.set(slug, { at: Date.now(), v });
    return v;
  }
}
