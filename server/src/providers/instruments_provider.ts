import envconfig from '../config/envconfig';

const sources = Object.keys(envconfig.instruments_providers);
const providers = {};
for (let i = 0; i < sources.length; ++i) {
  const source = sources[i];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const provider = require(envconfig.instruments_providers[source]);
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

export async function getAllInstruments(source, minCapitalization) {
  if (source) {
    if (providers[source]) {
      return await providers[source].getAllInstruments(
        source,
        minCapitalization
      );
    } else {
      return [];
    }
  } else {
    const result: any[] = [];
    for (let i = 0; i < sources.length; ++i) {
      const instruments = await providers[sources[i]].getAllInstruments(
        sources[i],
        minCapitalization
      );
      if (instruments && instruments.length > 0) {
        for (let k = 0; k < instruments.length; ++k) {
          result.push(instruments[k]);
        }
      }
    }
    return result;
  }
}

export async function getInstrumentByUrl(source, url) {
  if (source) {
    if (providers[source]) {
      return await providers[source].getInstrumentByUrl(source, url);
    } else {
      return null;
    }
  } else {
    for (let i = 0; i < sources.length; ++i) {
      const instrument = await providers[sources[i]].getInstrumentByUrl(
        sources[i],
        url
      );
      if (instrument) {
        return instrument;
      }
    }
  }
}

export async function getIsinWkn(source, instrumentId) {
  if (providers[source]) {
    return await providers[source].getIsinWkn(source, instrumentId);
  } else {
    return null;
  }
}

export async function getInstrumentId(source, isin, wkn) {
  if (providers[source]) {
    return await providers[source].getInstrumentId(source, isin, wkn);
  } else {
    return null;
  }
}

export async function updateInstruments(source, sql) {
  if (providers[source]) {
    return await providers[source].updateInstruments(source, sql);
  }
}
