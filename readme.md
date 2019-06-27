# Coal Tracker Frontend Rebuild
Project with [Coal Swarm](coalswarm.org) to rebuild coal_tracker as a front-end application. For the original application, see https://github.com/GreenInfo-Network/coal_tracker, which is hosted on Kattare (still running from there as of June 2019)

* Quickbooks: CoalSwarm:Coal Plant Tracker 2019
* URL: https://greeninfo-network.github.io/coal-tracker-client/

## Hosting

We will initially be hosting this on GH pages. Eventually that URL will be used as the embed source on this page: https://endcoal.org/global-coal-plant-tracker/

## Development

Pre-requisites:
* Node and npm
* Yarn

To match the development node version:
```
npm use
```

First time only:
```
yarn install
```

To start a development server:
```
yarn start
```

## Documentation

TO DO:
1. how to derive countries.json (copy from documentation in Coal Tracker, or Renewables Tracker, etc.)
2. how to derive trackers.csv from the global XLS sheet (including dropping fields, etc.)

fields to keep:
```
'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent'
```

Basic steps
- open w/Google Sheets (or get sheets link)
- download the data sheet as CSV (named `coal.csv` in the example)
- rename fields with commas - these are problematic in csvcut for some reason, e.g. "Subnational unit (province, state)" >> "Subnational unit (province/state)"
- extract cols to keep with `csvcut` (part of `csvkit`)

```
csvcut -c 'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent' coal.csv > trackers.csv
```