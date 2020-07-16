// node script that uses a lookup file (country_lookup.csv) to match country names in the data 
// to country names in world.json
// see readme.md for additional details
// usage: node index.js

const fs = require('fs');
const exec = require('child_process').exec;
var lineByLine = require('n-readlines');
const csv = require('csvtojson');

// OGR options
const precision = 3;
const simplification = 0.009;

// Pointers to required input files, and the name of the output
const outfile            = 'countries.json';       // the output country geojson file we are createing
const infile             = 'world.json';           // the country reference file
const datafile           = 'coal.csv'; // the data with country names
const country_name_index = 4                       // the column index for the country names
const lookupfile         = './country_lookup.csv'; // the lookup to match data to geojson 

// define a helper for reducing arrays to unique items
const uniq = (a) => { return Array.from(new Set(a));}

// create a country lookup from the country_lookup CSV file
var lines = new lineByLine(lookupfile);
var line;
var lookup = {};
while (line = lines.next()) {
  var items = line.toString('ascii').split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // split on commas, except where bounded by quotes
  var name = items[1].replace(/\s+/g, ' ').trim(); // replace any double spaces, and trim
  name = name.replace(/['"]+/g, '');  // remove internal double quotes
  if (items[0] != '') lookup[items[0]] = {name: name}; 
}

// read the data file, and check incoming country names against the lookup
var countries = [];
csv()
  .fromFile(datafile)
  .on('csv',(row, rowIndex) => {
    // here we have countries in two places - so make a single list from both
    var country_list = row[country_name_index].split(/,|-/);
    var uniq_list = uniq(country_list);
    uniq_list.forEach(function(country) { if (country) countries.push(country.trim()) })
  })
  .on('json',(json) => {})
  .on('done',(error) => {
    console.log('Done reading CSV');
    var err = false;
    var errmsg = "";
    var names = [];
    // sort a unique list of the result
    // this shows all the country names listed in the data
    countries = uniq(countries).sort();
    console.log(countries);
    countries.forEach(function(c) {
      // exceptions. This data is dirty, and we need to skip some known bad values: 
      var bad_values = ['Global','Multilateral','TBD','TBD (South Korea)','TBD (South Korea/Japan)'];
      if (bad_values.indexOf(c) > -1) return;

      if (typeof lookup[c] === 'undefined') {
        // entering error state!
        // the export won't complete as long as there are errors
        // use the errors printed here to fix country_lookup.csv and try again
        err = true;
        console.log("Error: " + c, lookup[c])
      } else {
        names.push(lookup[c].name);
      }
    });

    // done lookup, any errors? 
    if (err == false) {
      // hooray! no errors, on to geojson generation
      generateJson(names);
    } else {
      console.log("ERROR ^^ Fix the missing country lookups shown above in country_lookup.csv, then run again");
    }
  });

// in the future, we could explicitly write out JSON, line by line, and in the process swap in the names we want to use (to match the data)
function generateJson(names) {
  // make sure the file_list contains only unique entries
  names = uniq(names);
  // and join into the format needed by SQL
  names = '(' + names.map(name => `'${name}'`).join(',') + ')';

  // As of v2.2 of GDAL requires you to name the "table" in the SQL statement
  // http://www.gdal.org/drv_geojson.html
  let table = infile.split(".")[0];

  // now spawn a call to OGR to do the job:
  let command = `ogr2ogr -f geojson -dialect sqlite -sql "select * from ${table} where NAME in ${names}" ${outfile} ${infile} -lco COORDINATE_PRECISION=${precision} -simplify ${simplification}`
  exec(command);
}
