# make_countries_json.py

# dependencies 
# GDAL/ogr

# usage: 
# ensure that the input and output filenames are correct, below
# python3 make_countries_json.py 

# when complete, copy countries.json to ../static/data

# Update 4/2022:
# Mason/GEM has a standardized set of global country names, and I have copied these into world.json
# I've also updated country_lookup.csv
# Given that, there is no longer anything to look up as incoming data names should match names in world.json 1:1
# 
# That said, we still need to run this script for two reasons
# 1) As a check on incoming data names. If something doesn't match country_lookup.csv, it gets flagged here and can be corrected in data.csv (and upstream in the spreadsheets)
# 2) To subselect countries from world.json to use on the map as countries.json

import csv
import os
import json
import os
import pandas as pd

# OGR options
precision = 3
simplification = 0.009

# file names
infile = '../../data/trackers.json'
lookupfile = 'country_lookup.csv'
worldjson = 'world.json'
outjson = 'countries.json'

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

# kick it all off with:
run()
