import envconfig from '../config/envconfig';

const sources = Object.keys(envconfig.rates_providers);
const providers = {};
for (let i = 0; i < sources.length; ++i) {
  const source = sources[i];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const provider = require(envconfig.rates_providers[source]);
  if (provider) {
    providers[source] = provider;
  }
}

const _sources = sources;
export { _sources as sources };
const _providers = providers;
export { _providers as providers };
export const market_not_found = 'market not found';
export const invalid_response = 'invalid response';

export async function getRates(
  source,
  instrumentId,
  preferredMarketId,
  startTime,
  endTime,
  checkRates
) {
  if (providers[source]) {
    let marketIds = providers[source].markets;
    if (
      preferredMarketId != null &&
      typeof preferredMarketId === 'string' &&
      preferredMarketId.length > 0
    ) {
      const index = marketIds.indexOf(preferredMarketId);
      if (index > -1) {
        // remove known market from list
        marketIds.splice(index, 1);
      }

      // push known market to front of list
      marketIds.unshift(preferredMarketId);
    }

    let ratesResponse: any = null;

    for (let m = 0; m < marketIds.length; ++m) {
      const marketId = marketIds[m];

      ratesResponse = await providers[source].getRates(
        source,
        instrumentId,
        marketId,
        startTime,
        endTime
      );

      if (await checkRates(ratesResponse.Rates, marketId)) {
        for (let r = 0; r < ratesResponse.Rates.length; ++r) {
          let time = ratesResponse.Rates[r].Time;
          if (time.getHours() > 12) {
            time = new Date(time.getTime() + 12 * 60 * 60 * 1000);
          }
          time.setHours(0, 0, 0, 0);
          ratesResponse.Rates[r].Time = time;
        }

        ratesResponse.Source = source;
        ratesResponse.MarketId = marketId;
        break;
      }

      ratesResponse.Rates = null;

      if (ratesResponse.MarketIds) {
        // remove markets that dont exist
        marketIds = marketIds.filter(
          (x) => ratesResponse.MarketIds.indexOf(x) > -1
        );
        m = marketIds.indexOf(marketId);
      }
    }

    if (marketIds.length == 0) {
      throw new Error(market_not_found);
    }

    return ratesResponse;
  } else {
    return null;
  }
}
