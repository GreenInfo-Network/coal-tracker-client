# trackercsv2json.py
# usage: python3 trackercsv2json.py infile.csv outfile.json
import csv
import json
import sys
import itertools

csvfile = open(sys.argv[1], 'r')
jsonfile = open(sys.argv[2], 'w')

# utilities
def lower_first(iterator):
    return itertools.chain([next(iterator).lower()], iterator)

# the following dictionary maps our fieldnames to those in the incoming CSV (lower cased here to avoid one area of potential conflict)
# The script will note missing fields
field_lookup = {
    'tracker id': 'id',
    'wiki page': 'url',
    'country': 'country',
    'subnational unit (province, state)': 'subnational',
    'unit': 'unit',
    'plant': 'plant',
    'chinese name': 'chinese_name',
    'sponsor': 'sponsor',
    'parent': 'parent',
    'capacity (mw)': 'capacity',
    'status': 'status',
    'year': 'year',
    'region': 'region',
    'latitude': 'lat',
    'longitude': 'lng',
}

# the keys of said list
lookup_keys = list(field_lookup.keys())

# create the outer array to hold the output
output = []
missing_fields = []

# iterate the file
firstline = True
# open the csv as a Dictionary, remapping the fieldnames as given above
reader = csv.DictReader(lower_first(csvfile))
for index, row in enumerate(reader):
    # output.append(json.dumps(row))
    if firstline:    # skip first line
        firstline = False
        continue

    # check for missing or otherwise bad values in this row, and skip them
    if row['latitude'] == '': 
        continue 
    if row['longitude'] == '': 
        continue
    if row['status'] == '':
        continue
    if row['tracker id']== '':
        continue

    # seems like we're generally good. Now iterate this rows values, and clean and cast as needed
    outrow = {}
    for item in row:
        # make sure this item is in our list
        if item in lookup_keys:
            # id: create a numeric id, as this is faster for the search index
            if item == 'tracker id':
                value = index + 1
            # latitude and longitude: convert to float, and also skip empty values
            elif item == 'latitude' or item == 'longitude':
                value = float("{0:.5f}".format(float(row[item])))
            # status: make lower case and trim
            elif item == 'status':
                value = row[item].lower().strip()
            # everything else: take it as-is
            else: 
                value = row[item].strip()

            # append it to the outrow
            outrow[field_lookup[item]] = value

        else:
            if not item in missing_fields:
                missing_fields.append(item)

    # append this row to the output
    output.append(outrow)

json.dump(output, jsonfile)


print('Warning: The following fields could not be found: ' + ', '.join(missing_fields))
print('All done!')
