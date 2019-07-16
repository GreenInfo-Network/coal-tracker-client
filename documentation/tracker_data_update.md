# Update Tracker data from Spreadsheet

## Requirements
* [csv kit](https://csvkit.readthedocs.io/en/latest/)
* Python 3

## Steps
- obtain the latest spreadsheet from the client, likely a link to a Google Spreadsheet, or an XLS file
- download or save the data sheet as CSV 
- rename fields with commas - these are problematic in `csvkit/csvcut` for some reason, e.g. "Subnational unit (province, state)" >> "Subnational unit (province/state)"
- Use `csvcut` to extract cols to keep with `csvcut` (part of `csvkit`) (see below)
- Run the python script (see below) to clean up the data and convert to `json`

## Fields to keep:

```
'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent'
```

## csvcut

Run the following to reduce the CSV to only those fields we need
```
csvcut -c 'Tracker ID','Unit','Plant','Wiki page','Sponsor','Capacity (MW)','Status','Region','Country','Subnational unit (province/state)','Latitude','Longitude','Parent' coal.csv > trackers.csv
```

## convert to json

To save on load time and do some basic error checking/cleanup, we convert the tracker spreadsheet to JSON offline. 

Important: On each update, make sure that the field names listed within this script match the field names above, and in the data. See additional notes about this in the script itself. 

Run the following script (python3):
```
python3 tracker-data-script/trackercsv2json.py infile.csv outfile.json
```

When complete, copy the result to `./data/trackers.json`
