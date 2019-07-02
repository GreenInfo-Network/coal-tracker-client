# Data import and cleaning script

The purpose of this script is two-fold
1. Identify any country names present in `data.csv` that don't match country names in the `world.json` geojson
2. Get unique country names from `data.csv`, and use that to export a set of matching countries from `world_with_taiwan_in_china.json`, that can be used in the application as `data/countries.json`

#### Requirements
* nvm >= 0.33.6
* Node >= 6.9.5
* Yarn >= 1.3.2
* ogr2ogr >= 2.2.4

#### Getting started
To get the correct Node version from `.nvmrc`:
```
nvm use
```

To install libraries used by the scripts
```
yarn install
```

## Purpose

Project data are provided in `trackers.csv`, whereas country geo-data comes from `world.json`. Names in the data don't always match and need some cleanup, to be used. 

This script checks country names in the data against a lookup that matches country names to their equivalents in `world.json`. Any countries that don't match are printed to the console.

#### To run
* Edit `index.js` and make sure it points to the correct input and output files
* Tweak ogr2ogr precision options as needed
* Run with `node index.js`

If a country is found in the data that doesn't match the lookup, add it to the countries_lookup sheet
`countries_lookup.csv`, and try again. 

The script won't go on to the next step as long as there are mis-matched coutries. 

Once country names are cleaned up, run `node index.js` a final time to create the `countries.json` file needed by the app. When complete, copy the result to `./data/countries.json`. Also copy `country_lookup.csv` to `./data/`, as this will be used at runtime for more or less the same purpose - to match country names in data to the countries geojson

#### Note
1. The simplification (see `const simplification` in `index.js`) may need to be tweaked for larger country sets. Generally not aiming to have a geojson download of more than 1-2 MB max (uncompressed)
