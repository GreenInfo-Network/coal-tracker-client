# readmd.md


Scans the latest data.csv for country names, matches these to country names in world.json, and exports a countries.json for use in the appliation

Required: 
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