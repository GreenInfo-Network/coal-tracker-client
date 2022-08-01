# readme.md

Scans the latest data.csv for country names, matches these to country names in world.json, and exports a countries.json for use in the appliation

## Update 4/22

Mason/GEM has a standardized set of global country names, and I have copied these into `world.json`. I've also updated these in `country_lookup.csv`. Given that, there is no longer anything to "look up" as incoming data names _should_ match names in `world.json` 1:1

That said, we still need to run this script for two reasons
1. As a check on incoming data names. If something doesn't match `country_lookup.csv`, it gets flagged here and can be corrected in `data.csv` (and upstream in the spreadsheets)
2. To subselect countries from `world.json` to use on the map as `countries.json`


### Required: 
* Python3 
* ogr2ogr/GDAL
* countries_lookup.csv: This should have all the keys needed to map country names from data.csv to a matching country name in world.json. But don't worry, if a match cannot be found, the script will exit and let you know. Fix it, and run again.

To run: 

```python
# first ensure that the input and output filenames are correctly set within the script, then
python make_countries_json.py

# or the following, depending on your setup 
python3 make_countries_json.py
```

When complete: 

```bash
# Move the countries.json that the script produced, replacing the one in data/countries.json
mv countries.json ../../data
```