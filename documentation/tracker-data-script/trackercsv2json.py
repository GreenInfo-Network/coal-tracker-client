# trackercsv2json.py
# usage: trackercsv2json.py infile.csv outfile.json
import csv
import json
import sys

csvfile = open(sys.argv[1], 'r')
jsonfile = open(sys.argv[2], 'w')

# use this list to change fieldnames in the incoming csv to whatever label you want in the output JSON, 
# and in the application 
# Important: this list is positional, so if the CSV has 10 fields, there should be 10 fieldnames here, in the same order
# Also important: this list should match the keys in CONFIG.attributes in the app
fieldnames = ('id','unit','chinese_name','plant','url','sponsor','parent','capacity','status','region','country','subnational','lat','lng','year')

# create the outer array to hold the output
output = []

# iterate the file
firstline = True
# open the csv as a Dictionary, remapping the fieldnames as given above
reader = csv.DictReader(csvfile, fieldnames)
for row in reader:
    # output.append(json.dumps(row))
    # print(row)
    if firstline:    # skip first line
        firstline = False
        continue

    # check for missing or otherwise values
    if row['lat'] == '': 
        continue 
    if row['lng'] == '': 
        continue
    if row['status'] == '':
        continue
    if row['id'] == '':
        continue

    # seems like we're generally good. Now iterate this rows values, and clean and cast as needed
    outrow = {}
    for item in row:
        # latitude and longitude: convert to float, and also skip empty values
        if item == 'lat' or item == 'lng':
            value = float("{0:.5f}".format(float(row[item])))
        # status: make lower case
        elif item == 'status':
            value = row[item].lower()
        # everything else: take it as-is
        else: 
            value = row[item]

        # append it to the outrow
        outrow[item] = value

    # append this row to the output
    output.append(outrow)

json.dump(output, jsonfile)