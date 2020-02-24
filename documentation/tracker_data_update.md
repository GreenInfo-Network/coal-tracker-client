# Update Tracker data from Spreadsheet

## Requirements
* [csv kit](https://csvkit.readthedocs.io/en/latest/)
* Python 3

## Steps
- obtain the latest spreadsheet from the client, likely a link to a Google Spreadsheet, or an XLS file
- download or save the data sheet as CSV. Note: if given file is Excel, first upload to Sheets, then save as CSV (this should help with UTF encoding issues)
- Run the python script (see below) to clean up the data and convert to `json`

## convert to json

To save on load time and do some basic error checking/cleanup, we convert the tracker spreadsheet to JSON offline. 

Important: On each update, make sure that the field names listed within this script match the field names above, and in the data. See additional notes about this in the script itself. 

Run the following script (python3):
```
python3 tracker-data-script/trackercsv2json.py infile.csv outfile.json
```

When complete, copy the result to `./data/trackers.json`
