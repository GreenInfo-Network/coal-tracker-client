# Update Tracker data from Spreadsheet

## Steps
- open w/Google Sheets (or get sheets link)
- download the data sheet as CSV (named `coal.csv` in the example)
- rename fields with commas - these are problematic in csvcut for some reason, e.g. "Subnational unit (province, state)" >> "Subnational unit (province/state)"
- Use `csvcut` to extract cols to keep with `csvcut` (part of `csvkit`)
- convert to JSON

## Fields to keep:

```
'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent'
```

## csvcut
```
csvcut -c 'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent' coal.csv > trackers.csv
```

## convert to JSON

Run the following script (python3):
```
python3 tracker-data-script/trackercsv2json.py infile.csv outfile.json
```