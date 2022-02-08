# make_countries_json.py

# dependencies 
# GDAL/ogr

# usage: 
# ensure that the input and output filenames are correct, below
# python3 make_countries_json.py 

# when complete, move countries.json to ../../data/countries.json 

import csv
import os
import json
import os

# OGR options
precision = 3
simplification = 0.009

# file names
infile = '../../data/trackers.json'
lookupfile = 'country_lookup.csv'
worldjson = 'world.json'
outjson = 'countries.json'
outjson_fixed = 'countries_fixed.json'

def run():

    # open the data file, and get a unique list of all countries
    raw = []

    with open(infile) as jsonfile:
        data = json.load(jsonfile)
        for row in data:
            raw.append(row['country'])

    data_countries = set(raw)

    # open "lookupfile" and create a "lookup" dict that maps data_country names to geo_country names 
    lookup = {}
    with open(lookupfile, 'rt', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            dataname = row['Name_csv']
            geoname = row['Name_map']
            lookup[dataname] = geoname

    # iterate over the data_countries, looking for a match in the lookup, noting any errors 
    matches = []
    for country in data_countries: 
        errors = False
        match = lookup[country]

        if not match: 
            errors = True
            print('Error: ' + country + ' not found in lookup, please correct')
        else:
            matches.append(match)

    # done lookup test, any errors?
    if not errors:
        generateJson(matches)
        fixCountryNames(outjson)
    else:
        print('ERROR ^^ Fix the missing country lookups shown above in country_lookup.csv, then run again')

# the function to produce the countries.json from world.json based on matching set of names
def generateJson(matches):
    # map to the format needed
    names = '(' + ','.join("'{0}'".format(m) for m in matches) + ')'

    # As of v2.2 of GDAL requires you to name the "table" in the SQL statement
    # http://www.gdal.org/drv_geojson.html
    table = worldjson.split('.')[0]

    # now spawn a call to OGR to do the job:
    command = f'ogr2ogr -f geojson -dialect sqlite -sql "select * from {table} where NAME in {names}" {outjson} {worldjson} -lco COORDINATE_PRECISION={precision} -simplify {simplification}'
    
    # replace / escapes with '' for country names that have apostrophe
    replacement = "''"
    command = command.replace('/', replacement)
    print(command)

    # execute the ogr2ogr command
    os.system(command)


def fixCountryNames(outjson):
    # open "lookupfile" and create a "lookup" dict that maps data_country names to geo_country names 
    lookup = {}
    with open(lookupfile, 'rt', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            dataname = row['Name_csv']
            geoname = row['Name_map']
            # note this is the opposite of the lookup above
            # here we are translating from the map name to the data name
            # also note: this will match the first key found. So if there are duplicates in the first column in the lookup sheet, you might not get what you expect
            lookup[geoname] = dataname

    with open(outjson, 'r') as file:
        json_data = json.load(file)
        for feature in json_data['features']:
            map_name = feature['properties']['NAME']
            data_name = lookup[map_name]
            feature['properties']['NAME'] = data_name

    with open(outjson_fixed, 'w') as file:
        json.dump(json_data, file, indent=None, separators=(',', ':'), )

    # final step: delete and rename
    os.remove(outjson)
    os.rename(outjson_fixed, outjson)

# kick it all off with:
run()
