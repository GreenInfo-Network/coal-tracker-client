# Coal Tracker Frontend Rebuild
Project with [Global Energy Monitor](https://globalenergymonitor.org/) to rebuild coal_tracker as a front-end application. For the original application, see https://github.com/GreenInfo-Network/coal_tracker

https://greeninfo-network.github.io/coal-tracker-client/

## Hosting

The app is hosted on GH pages and the source is embedded on this page: https://endcoal.org/global-coal-plant-tracker/

## Data

#### Companies
The client provides a hard-coded list of companies, which we use to populate "company search". To update, simply save the list as `data/companies.txt`

#### Trackers
The coal plants themselves are managed by the client. Export to CSV, and then run it through this script `documentation/tracker-data-script/trackers2json.py` to generate the data in `json` format. When complete, replace `data/trackers.json` with the new file. More information: `documentation\tracker_data_update.md`

#### Countries
To update country data, see the script in `documentation\country-json-script\index.js`. Additional information is in `documentation\country_data_update.md` and `documentation\country-json-script\readme.md`


## Development

Pre-requisites:
* Node (>=10.0) and npm (>=5.6.0)
* Yarn (>=1.17.0)

To match the development node version with `nvm`:
```
nvm use
```

First time only:
```
yarn install
```

To start a development server:
```
yarn start
```

## Data updates
See additional readme's in `documentation/` for details on updating tracker point data and country polygon data
