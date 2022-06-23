const https = require('https');
const fs = require('fs');

function request(path, domain) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: domain ?? 'countriesnow.space',
      path: domain ? path : '/api/v0.1/countries' + path,
      method: 'GET',
      port: 443,
    }, res => {
      let result;

      res.on('data', data => {
        result = result ? result + data : data;
      });

      res.on('end', () => {
        resolve(JSON.parse(result.toString()));
      });
    });

    req.end();
  });
}

function downloadFlag(iso3) {
  const req = https.request({
    hostname:'raw.githubusercontent.com',
    path: `/mledoze/countries/master/data/${iso3.toLowerCase()}.svg`,
    method: 'GET',
    port: 443,
  }, res => {
    let result;

    res.on('data', data => {
      result = result ? result + data : data;
    });

    res.on('end', () => {
      fs.writeFileSync(`flags/${iso3.toLowerCase()}.svg`, result);
    });
  });

  req.end();
}

(async () => {
  const [cities, states, codes, countries, counties] = await Promise.all([
    request(''),
    request('/states'),
    request('/codes'),
    request('/mledoze/countries/master/dist/countries-unescaped.json', 'raw.githubusercontent.com'),
    request('/api/v1', 'counties-kenya.herokuapp.com')
  ]);

  const citiesMapped = {};
  cities.data.forEach(city => {
    citiesMapped[city.iso2] = city;
  });

  const statesMapped = {};
  states.data.forEach(state => {
    statesMapped[state.iso2] = state;
  });

  const codesMapped = {};
  codes.data.forEach(code => {
    codesMapped[code.code] = code;
  });

  const result = countries.map(country => {
    const item = {
      name: country.name.common,
      iso2: country.cca2,
      iso3: country.cca3,
      capital: country.capital.filter(city => city),
      region: country.region,
      subregion: country.subregion,
      languages: Object.values(country.languages),
      cities: citiesMapped[country.cca2]?.cities ?? country.capital.filter(city => city),
      currencies: Object.keys(country.currencies).map(key => ({
        name: country.currencies[key].name,
        currency: key,
        symbol: country.currencies[key].symbol,
      })),
      flag: country.flag,
      callingCodes: codesMapped[country.cca2] ? [codesMapped[country.cca2].dial_code] : country.callingCodes.filter(code => code),
    }

    if (country.cca2 === 'KE') {
      item.states = counties.map(county => ({
        name: county.name,
        code: county.code,
      }));
    } else {
      if (statesMapped[country.cca2]?.states.length) {
        item.states = statesMapped[country.cca2]?.states.map(state => ({
          name: state.name,
          code: state.state_code,
        }));
      } else {
        item.states = item.capital.map(capital => ({
          name: capital,
          code: item.iso3,
        }));
      }
    }

    downloadFlag(country.cca3);

    return item;
  });

  fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
})();
