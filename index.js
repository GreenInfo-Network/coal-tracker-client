///////////////////////////////////////////////////////////////////////////////////////////////////////////
// IMPORTS
///////////////////////////////////////////////////////////////////////////////////////////////////////////
import MobileDetect from 'mobile-detect';
const Promise = require('es6-promise-polyfill').Promise;
import * as JsSearch from 'js-search';

///////////////////////////////////////////////////////////////////////////////////
// STYLES, in production, these will be written to <script> tags
///////////////////////////////////////////////////////////////////////////////////
// import './loading.css';
import styles from './index.scss';

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARIABLES & STRUCTURES
///////////////////////////////////////////////////////////////////////////////////////////////////////////
// global config
const CONFIG = {};
const DATA = {};

// basemap definitions, no options here, just a single set of basemap tiles and labels above features. see initMap();
CONFIG.basemaps = {
  'hybrid': L.tileLayer('https://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg', { zIndex:1 }),
  'satellite': L.gridLayer.googleMutant({ type: 'satellite' }),
  'basemap' : L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', { attribution: '©OpenStreetMap, ©CartoDB' }),
  'labels': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}@2x.png', { pane: 'labels' }),
};

// specify which basemap will be on by default, and when the map is reset by the 'Reset' button
CONFIG.default_basemap = 'basemap';

// default title for results
CONFIG.default_title = 'Worldwide';

// outerring, used for constructing the mask, see drawCountry();
CONFIG.outerring = [[-90,-360],[-90,360],[90,360],[90,-360],[-90,-360]];
// the starting view: bounds, see initMap()
CONFIG.homebounds = [[51.069, 110.566], [-36.738,-110.566]];

// minzoom and maxzoom for the map
CONFIG.minzoom = 2;
CONFIG.maxzoom = 15;

// Style definitions (see also scss exports, which are imported here as styles{})
// a light grey mask covering the entire globe
CONFIG.maskstyle = { stroke: false, fillColor: '#999', fillOpacity: 0.2, className: 'mask' };
// style for highlighting countries on hover and click
CONFIG.country_hover_style    = { stroke: false, fillColor: '#fffef4', fillOpacity: 0.9 };
CONFIG.country_selected_style = { stroke: false, fillColor: '#fff', fillOpacity: 1 };
// an "invisible" country style, as we don't want countries to show except on hover or click
CONFIG.country_no_style = { opacity: 0, fillOpacity: 0 };
// feature highlight styles, shows below features on hover or click
CONFIG.feature_hover_style  = { color: '#fff5a3', fillOpacity: 1, stroke: 13, weight: 13, opacity: 1 };
CONFIG.feature_select_style = { color: '#f2e360', fillOpacity: 1, stroke: 13, weight: 13, opacity: 1 };

// primary attributes to display: used in the table, for searching, displaying individual results on map popups, etc.
CONFIG.attributes = {
  'id': {name: 'Tracker ID'},
  'unit': {name: 'Unit'},
  'plant': {name: 'Plant'},
  'url': {name: 'Wiki page'},
  'sponsor': {name: 'Sponsor'},
  'capacity': {name: 'Capacity (MW)'},
  'status': {name: 'Status'},
  'region': {name: 'Region'},
  'country': {name: 'Country'},
  'subnational': {name: 'Subnational unit (province/state)'},
  'lat': {name: 'Latitude'},
  'lng': {name: 'Longitude'},
  'parent': {name: 'Parent'},
};

// the Universe of status types: these are the categories used to symbolize coal plants on the map
//          key: allowed status names, matching those used in DATA.fossil_data
//          text: human readible display
//          color: imported from CSS
CONFIG.status_types = {
  'operating': {'text': 'Operating', 'order': 1 },
  'construction': {'text': 'Construction', 'order': 2 },
  'proposed': {'text': 'Proposed', 'order': 3 },
  'cancelled': {'text': 'Cancelled', 'order': 4 },
  'shelved': {'text': 'Shelved', 'order': 5 },
  'retired': {'text': 'Retired', 'order': 6 },
  'mothballed': {'text': 'Mothballed', 'order': 7 },
};

// define primary types here. This structure will also be used to hold Leaflet Geojson layers, and other properties
CONFIG.fossil_types = {
  'Coal Terminal': {'name': 'Coal Terminals', 'symbol': 'circle'},
  'LNG Terminal': {'name': 'LNG Terminals', 'symbol': 'circle'},
  // at some point, they dropped the word 'pipeline' from their pipeline data "type" field
  'Oil': {'name': 'Oil Pipelines', 'symbol': 'line'},
  'Gas': {'name': 'Gas Pipelines', 'symbol': 'line'},
};

// allowed url params. To support additional params, add them here
CONFIG.allowed_params = ['country'];
///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// INITIALIZATION: these functions are called when the page is ready,
///////////////////////////////////////////////////////////////////////////////////////////////////////////
$(document).ready(function () {
  // data initialization first, then the remaining init steps
  Promise.all([initData('./data/trackers.csv'), initData('./data/countries.json'), initData('./data/country_lookup.csv')])
    .then(function(data) {
      initDataFormat(data)    // get data ready for use
      initButtons();          // init button listeners
      initTabs();             // init the main navigation tabs
      initTable();            // the Table is fully populated from the trackers dataset, but is filtered at runtime
      initSearch();           // init the full text search
      initFreeSearch();       // init the "free" search inputs, which implement full-text search
      initMap();              // regular leaflet map setup
      initMapLayers();        // init some map layers and map feature styles
      initMapControls();      // initialize the layer and basemap pickers, etc.
      initState();            // init app state given url options

      // ready!
      setTimeout(function () {
        resize();
        $('div#pleasewait').hide();
      }, 300);
    }); // Promise.then()
});

// listen for changes to the window size and resize the map
$(window).resize(function() {
  // resize the map, table and content divs to fit the current window
  resize(); 
})

// resize everything: map, content divs, table
function resize() {
  // calculate the content height for this window: 
  // 42px for the nav bar, 10px top #map, 10px top of #container = 42 + 20 + 10
  var winheight = $(window).height();
  var height = winheight - 54;
  if (height > 1000) height = 1000; // on giant screens, we need a max height

  // resize the map
  $('div#map').height(height - 8); 
  CONFIG.map.invalidateSize();

  // resize the content divs to this same height
  $('div.content').height(height);

  // resize the table body
  // guesstimate a good scrollbody height; dynamic based on the window height
  var tablediv = $('.dataTables_scrollBody');
  if (!tablediv.length) return;

  // starting value
  var value = $(window).width() < 768 ? 248 : 240;
  // differential sizing depending on if there is a horizontal scrollbar or not
  if (tablediv.hasHorizontalScrollBar()) value += 10;
  var height = $('body').height() - value;
  // set the scrollbody height via css property
  tablediv.css('height', height);
  CONFIG.table.columns.adjust().draw();

}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// Functions called on doc ready
///////////////////////////////////////////////////////////////////////////////////////////////////////////
// Basic data init, returns a promise
function initData(url) {
  // wrap this in a promise, so we know we have it before continuing on to remaining initialize steps
  return new Promise(function(resolve, reject) {
    $.get(url, function(data) {
      resolve(data);
    });
  });
}

// data parsing and formatting, once data are on-board
function initDataFormat(data) {
  // set country data equal to the second data object from the initData() Promise()
  DATA.country_data = data[1];

  // set up a country-lookup, to map country names as provided in the raw spreadsheet data, to country names we have in the country topojson
  var lookup = Papa.parse(data[2], {header: true});
  DATA.country_lookup = {};
  lookup.data.forEach(function(row, i) {
    DATA.country_lookup[row.data] = row.map;
  });

  // Tracker data: convert CSV to JSON
  // and keep a reference to this in DATA
  var trackers_json = Papa.parse(data[0], {
    header: true,
    // replace the headers with ones shorter, easier to access
    beforeFirstChunk: function(chunk) {
      var rows = chunk.split( /\r\n|\r|\n/ );
      rows[0] = Object.keys(CONFIG.attributes);
      return rows.join("\r\n");
    },
  });
  DATA.tracker_data = trackers_json.data;
  console.log(DATA.tracker_data[0]);
}

// take our oddly formatted country lists and normalize it, standardize it
// DANGER this all assumes no country names that themselves include a comma, which we don't have now, but may some day
// NOTE "countries" lists no longer include dashes, but leaving this as-is, for potential future compatibility
function formatCountryList(countries) {
  // first split the incoming list by the two delimeters used in the raw data, '-' and ','
  var list = countries.split(/,|-/);
  list = uniq(list);
  // then look up each member and match it to a common name in DATA.country_lookup
  var normalized = [];
  list.forEach(function(n) {
    normalized.push(DATA.country_lookup[n.trim()])
  });
  // and return the normalized list as a comma-delimited string
  return normalized.join(', ');
}

// init state from allowed params, or not
function initState() {
  // first check if we are loading from url params or not
  var params = window.location.href;
  // if we have url params, get the params and use them to set state
  if (params.indexOf('?') > -1) {
    setStateFromParams();
  } else {
    resetTheMap();
  }
}

// TO DO: match Coal Tracker here
function setStateFromParams() {
  // get the params
  var rawparams = $.url(params);
  var params = rawparams.data.param.query;
  var type = Object.keys(params)[0];
  var place = params[type];
  // error checking 1: check for existence of a valid param type as defined in CONFIG.allowed_params
  if (CONFIG.allowed_params.indexOf(type) == -1) return true;
  // error checking 2: put name in proper case
  var place = place.toTitleCase();
  // all is well, do the search
  // currently the only search type we support by params is 'country'
  searchCountry(place);
}

function initButtons() {
  // "reset" button that resets the map
  $('div a#reset-button').on('click', function(){
    resetTheMap();
  });

  // search icons on the search forms, click to submit
  $('form.search-form span.glyphicon-search').on('click', function() {
    $(this).closest('form').submit();
  });

  // close button, generically closes it's direct parent
  $('div.close').on('click', function() { $(this).parent().hide(); });

  // init the layer icon control to open the legend
  $('#layers-icon').on('click', function() { $('div.layer-control').show(); });

  // init the menu icon to open the "results" panel
  $('div#results-icon').on('click', function() { $('div#country-results').show(); });

  // the clear search button, clears the search input
  $('div.searchwrapper a.clear-search').on('click', function() {
    $(this).siblings('input').val('').trigger('keyup');
    $(this).hide();
  });
}

// initialize the map in the main navigation map tab
function initMap() {
  // basic leaflet map setup
  CONFIG.map = L.map('map', {
    attributionControl:false,
    zoomControl: false,
    minZoom: CONFIG.minzoom, maxZoom: CONFIG.maxzoom,
    attribution: "Interactive mapping by GreenInfo Network. Data: CoalSwarm"
  });

  // add zoom control, top right
  L.control.zoom({
    position:'topright'
  }).addTo(CONFIG.map);

  // map panes
  // - create a pane for basemap tile labels
  CONFIG.map.createPane('labels');
  CONFIG.map.getPane('labels').style.zIndex = 475;
  CONFIG.map.getPane('labels').style.pointerEvents = 'none';
  // - create map panes for county interactions, which will sit between the basemap and labels
  CONFIG.map.createPane('country-mask');
  CONFIG.map.getPane('country-mask').style.zIndex = 320;
  CONFIG.map.createPane('country-hover');
  CONFIG.map.getPane('country-hover').style.zIndex = 350;
  CONFIG.map.createPane('country-select');
  CONFIG.map.getPane('country-select').style.zIndex = 450;
  CONFIG.map.createPane('feature-highlight');
  CONFIG.map.getPane('feature-highlight').style.zIndex = 530;
  CONFIG.map.createPane('feature-pane');
  CONFIG.map.getPane('feature-pane').style.zIndex = 550;

  // add attribution
  var credits = L.control.attribution().addTo(CONFIG.map);
  credits.addAttribution('Interactive mapping by <a href="http://greeninfo.org" target="_blank">GreenInfo Network</a>. Data: <a href="http://coalswarm.org/" target="_blank">CoalSwarm</a>');

  // Add a feature group to hold the mask, essentially a grey box covering the world minus the country in the view
  CONFIG.mask = L.featureGroup([L.polygon(CONFIG.outerring)], {pane: 'country-mask' }).addTo(CONFIG.map);
  CONFIG.mask.setStyle(CONFIG.maskstyle);

  // Add a layer to hold feature highlights, for click and hover (not mobile) events on fossil features
  CONFIG.feature_hover = L.featureGroup([], {}).addTo(CONFIG.map);
  CONFIG.feature_select = L.featureGroup([], {}).addTo(CONFIG.map);

  // Add a layer to hold countries, for click and hover (not mobile) events on country features
  CONFIG.countries = L.featureGroup([], { pane: 'country-hover' }).addTo(CONFIG.map);
  var countries = L.geoJSON(DATA.country_data,{ style: CONFIG.country_no_style, onEachFeature: massageCountryFeaturesAsTheyLoad }).addTo(CONFIG.countries);

  // add a layer to hold any selected country
  CONFIG.selected_country = {};
  CONFIG.selected_country.layer = L.geoJson([], {style: CONFIG.country_selected_style, pane: 'country-select'}).addTo(CONFIG.map);

  // mobile: hide legend
  var layercontrol = $('.layer-control');
  if (isMobile()) layercontrol.hide();

  // once the map is done loading, resize and hide the loading spinner
  CONFIG.map.on('load', function() {
    resize();
    CONFIG.map.invalidateSize();
    setTimeout(function() {$('div#loading').hide();},200);
  });

  // when clicking the map (not a feature), clear selected features
  CONFIG.map.on('click', function(e) {
    // clear any selected features
    CONFIG.feature_select.clearLayers();              
  })
}

function initMapLayers() {
  // add the basemap and labels
  CONFIG.map.addLayer(CONFIG.basemaps.basemap);
  CONFIG.map.addLayer(CONFIG.basemaps.labels);

  // mobile feature styles: larger lines, bigger circles, for easier clicks
  if ( isMobile() ) {
    styles.linewidth = styles.linewidth_mobile;
    styles.circlesize = styles.circlesize_mobile;
  }
}

// init the legend and layer control
// there are two classes of controls, one for type and one for status
// they work 'semi-independently', you can toggle features on the map by type OR by status
function initMapControls() {
  // grab keys for fossil and status types
  var types    = Object.keys(CONFIG.fossil_types);
  var statuses = Object.keys(CONFIG.status_types);

  // What happens when you change a STATUS type checkbox?
  // 1. add/remove all layers for that status from the map
  $('div.layer-control div#status-types div.leaflet-control-layers-overlays').on('change', 'input', function(e) {
    var status = e.currentTarget.dataset.layer;
    var checkbox = $(this);
    types.forEach(function(type) {
      var layer = CONFIG.fossil_types[type]['layers'][status];
      // there might not be a layer at all for this type and status, so check for it first
      if (layer) {
        // then toggle its visibility
        if (checkbox.is(':checked')) {
          CONFIG.map.addLayer(layer);
        } else {
          layer.remove();
        };
      }
    });
    // 2. sync the FOSSIL type checkboxes to whatever is now actually visible on the map
    $('div.layer-control div#fossil-types div.leaflet-control-layers-overlays input').each(function(){
      var checkbox = $(this);
      var count = 0;
      var checked = checkbox.is(':checked');
      var type = $(this).data().layer;
      statuses.forEach(function(status) {
        var layer = CONFIG.fossil_types[type]['layers'][status];
        // if this layer exists and is on the map, add to the count
        if (layer) {
          if (CONFIG.map.hasLayer(layer)) count += 1;
        }
      });
      // check or uncheck this checkbox, depending on count
      var check = count > 0 ? true : false;
      checkbox.prop('checked',check);
    });
  });

  // What happens when you change a FOSSIL TYPE checkbox?
  // 1. add/remove all layers for that type from the map
  $('div.layer-control div#fossil-types div.leaflet-control-layers-overlays').on('change', 'input', function(e) {
    var type = e.currentTarget.dataset.layer;
    var checkbox = $(this);
    statuses.forEach(function(status) {
      // if this status is "off", then return, we don't need to consider it
      if (!$('div.layer-control div#status-types div.leaflet-control-layers-overlays input[data-layer="'+ status +'"]').is(':checked')) return;
      var layer = CONFIG.fossil_types[type]['layers'][status];
      // there might not be a layer at all for this type and status, so check for it first
      if (layer) {
        // then toggle its visibility
        if (checkbox.is(':checked')) {
          CONFIG.map.addLayer(layer);
        } else {
          layer.remove();
        };
      }
    });

    // 2. sync the STATUS type checkboxes to whatever is now actually visible on the map
    $('div.layer-control div#status-types div.leaflet-control-layers-overlays input').each(function(){
      var checkbox = $(this);
      var count = 0;
      var checked = checkbox.is(':checked');
      var status = $(this).data().layer;
      types.forEach(function(type) {
        var layer = CONFIG.fossil_types[type]['layers'][status];
        // if this layer exists and is on the map, add to the count
        if (layer) {
          if (CONFIG.map.hasLayer(layer)) count += 1;
        }
      });
      // check or uncheck this checkbox, depending on count
      var check = count > 0 ? true : false;
      checkbox.prop('checked',check);
    });
  });
}

// initialize the nav tabs: what gets shown, what gets hidden, what needs resizing, when these are displayed
// important: to add a functional tab, you must also include markup for it in css, see e.g. input#help-tab:checked ~ div#help-content {}
function initTabs()    {
  $('input.tab').on('click', function(e) {
    // get the type from the id
    var type = e.currentTarget.id.split("-")[0];
    switch (type) {
      case 'map':
        // show the correct search form, and resize the map
        $('#nav-table-search').hide();
        $('#nav-place-search').show();
        CONFIG.map.invalidateSize(false);
        break;
      case 'table':
        // resize the table, if it exists
        if (CONFIG.table) {
          resize();
        }
        // show the correct search form
        $('#nav-place-search').hide();
        $('#nav-table-search').show();
        break;
      default:
        // hide search forms
        $('form.search-form').hide();
        break;
    }
  });
}

// itialization functions for the table. Table data is populated only after a search is performed
function initTable() {
  // init the table search form. This mimics the built-in datatables 'filter', but includes the already selected area
  // this way, we only ever search within a given selection (either all records, or a subset)
  // if we are looking at the default table, do not filter, start from all records. Otherwise, use the selection term
  $('form#nav-table-search input').keyup(_.debounce(function() {
    if (!this.value) return render();
    $(this).submit();
  },200));

  // the submit function itself
  $('form#nav-table-search').on('submit', searchTableForText);
}

function initSearch() {
  // instantiate the search on a "universal id" (or uid in the docs)
  CONFIG.searchengine = new JsSearch.Search('id');
  // add fields to be indexed
  Object.keys(CONFIG.attributes).forEach(function(key){
    CONFIG.searchengine.addIndex(['properties', key]);
  });
  // add data documents to be searched
  var documents = [];
  DATA.tracker_data.forEach(function(row) {
    documents.push(row);
  });
  CONFIG.searchengine.addDocuments(documents);
}

// "Free" search searches the data for matching keywords entered in the input at top-right
// we use JSsearch https://github.com/bvaughn/js-search as the search "engine"
function initFreeSearch() {
  // This inits the "free search" form input, which looks for matching keywords in data
  $('form.free-search input').on('keyup', function(event) {
    // prevent default browser behaviour, especially on 'enter' which would refresh the page
    event.preventDefault();
    // if the input is cleared, redo the 'everything' search (e.g. show all results)
    // this is distinct from the case of "No results", in searchMapForText
    if (!this.value) return render();
    // submit the form
    $(this).submit();
  });

  // the submit function itself
  $('form.free-search').on('submit', searchMapForText);

}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// General functions
///////////////////////////////////////////////////////////////////////////////////////////////////////////

// Set up all map layers for all types and statuses, and set up layer objects in CONFIG.status_types['layers'], so we can turn them on and off later.
function drawMap(data, force=false) {
  // a simple caching system: if everything is already on the map, simply return, because there is no need to render it again
  // this lets us call drawMap() when simply clicking around countries, without hitting a full render repeatedly
  // pass force=true to skip this check and redraw regardless
  if (force == false && data.length == CONFIG.last_search_length && data.length == DATA.fossil_data.features.length && CONFIG.last_search_length == DATA.fossil_data.features.length) return;
  CONFIG.last_search_length = data.length;
  // grab keys for fossil and status types
  var types    = Object.keys(CONFIG.fossil_types);
  var statuses = Object.keys(CONFIG.status_types);
  // always first clear the map
  types.forEach(function(type) {
    if (CONFIG.fossil_types[type].hasOwnProperty('layers')) {
      statuses.forEach(function(status) {
        if (CONFIG.fossil_types[type]['layers'][status]) CONFIG.fossil_types[type]['layers'][status].remove();
      })
    }
  });

  // create a single layer for each status type in each fossil type
  // each will get a separate entry in the legend
  var legend_items = {types: [], statuses: []};
  types.forEach(function(type) {
    // differentiate between pipelines and terminals, as these have different styling, below
    var geom = type == 'Gas' || type == 'Oil' ? 'line' : 'point';
    // create an object to hold the resulting layers, so we can toggle them in the layer-control
    CONFIG.fossil_types[type]['layers'] = {};

    statuses.forEach(function(status) {
      if (!CONFIG.status_types[status].hasOwnProperty('count')) CONFIG.status_types[status].count = 0;
      var cssclass = `status${CONFIG.status_types[status]['order']}`;
      var layer = L.geoJSON(data, {
        pane: 'feature-pane',
        pointToLayer: function (feature, latlng) {
          // not sure if non-point features will sinply bypass this, but seems to be the case
          // in any case, explicity test for point before proceeding
          if (feature.geometry.type != "Point") return;
          // ok, we're not a line, carry on
          var icon = L.divIcon({
            // Specify a class name we can refer to in CSS.
            // fossil-feature allows us to distinguish between fossil features and countries on hover
            className: `fossil-feature circle-div ${cssclass}`,
            // Set the marker width and height
            iconSize: [styles.circlesize, styles.circlesize],
          });
          return L.marker(latlng, {icon: icon});
        },
        onEachFeature: function (feature, layer) {
          // Tooltips: only on Desktop, not mobile, not touch, not iPad
          if (! (isTouch() && ( isMobile() || isIpad() ))) {
            layer.bindTooltip(`<p>${feature.properties.project}</p>`, {className: 'fossil-tooltip', offset: [6,-16], sticky: true});
          }
          // bind a popup and a basic tooltip, regardless of feature type or geometry. When a popup opens, close any open tooltips
          layer.bindPopup(`<p><b>Project:</b> ${feature.properties.project}<br><b>Wiki page:</b> <a target="_blank" href="${feature.properties.url}">${feature.properties.url}</a></p>`);

          // get and set the color for this status
          // but only for pipelines
          if (layer.feature.geometry.type == "Point") return;
          // fossil-feature class allows us to distinguish between fossil features and countries on hover
          layer.setStyle({ color: styles[cssclass], weight: styles.linewidth, opacity: styles.lineopacity, 'className': 'fossil-feature' });
        },
        filter: function(feature) {
          if (feature.properties.type == type && feature.properties.status == status) {
            // log this type and status, for the legend
            if (legend_items.types.indexOf(type) < 0) legend_items.types.push(type);
            if (legend_items.statuses.indexOf(status) < 0) legend_items.statuses.push(status);
            // return true, for the L.geoJson filter, so this feature is added to the map
            return true;
          }
        }
      }).addTo(CONFIG.map);
      // looks like L.geoJson will make a layer even when it is empty of layers, so check for that
      if (layer.getLayers().length == 0) return;

      // hover: show the hovered feature with a hover style
      // but only on Desktop
      if (! (isTouch() && ( isMobile() || isIpad() ))) {
        layer.on('mouseover',function(e) {
          // point hover highlight: needed? Not sure, and hovering is causing a ton of 'flicker' for some reason
          // for now bypass point features, and only highlight lines
          if (geom == 'line') {
            var hover = L.polyline(e.layer.getLatLngs(), { pane: 'feature-highlight' });
            hover.setStyle(CONFIG.feature_hover_style);
            hover.addTo(CONFIG.feature_hover);
          }
        });
      }

      // when hovering off of a country, over a fossil feature, then 'off the map'
      // the country can sometimes stay highlighted. This removes that highlight
      // see also massageCountryFeaturesAsTheyLoad()
      if (! (isTouch() && ( isMobile() || isIpad() ))) {
        layer.on('mouseout',function(e) {
          if (e.originalEvent.target.classList.contains('mask')) CONFIG.countries.setStyle(CONFIG.country_no_style);
          // clear feature highlight, but not if one has been selected by click
          CONFIG.feature_hover.clearLayers();
        });
      }

      // add feature highlight on click
      layer.on('click', function(e) {
        // clear any existing feature highlights
        CONFIG.feature_select.clearLayers();
        // point select highlight: needed? Not sure, and hovering is causing a ton of 'flicker' for some reason
        // for now bypass point features, and only highlight lines
        if (geom == 'line') {
          var highlight = L.polyline(e.layer.getLatLngs(), { pane: 'feature-highlight' });
          highlight.setStyle(CONFIG.feature_select_style);
          highlight.addTo(CONFIG.feature_select);
        } 
      });

      // add the layer to the list by status, so we can toggle it on/off in the legend
      CONFIG.fossil_types[type]['layers'][status] = layer;
    }); // each status
  }); // each type

  // final step: update the legend
  drawLegend(legend_items);
}

// show and hide the correct legend labels and checkboxes for this set of data
// items comes from the data search itself
// note: see initMapControls() for event handlers on these controls
function drawLegend(items) {
  // create the legend from scratch, based on what fossil and status types are showing on the map
  $('div.leaflet-control-layers-overlays').html('');
  $('div.layer-control').hide();

  if (!items) return; // exit condition when no results

  // items is an object keyed to two arrays, types and statuses
  // iterate STATUS, and create the legend
  items.statuses.sort(function(a,b) {return CONFIG.status_types[a]["order"] - CONFIG.status_types[b]["order"]});
  items.statuses.forEach(function(status){
    var target = $('div.layer-control div#status-types div.leaflet-control-layers-overlays');
    // add a wrapper for the legend items
    var inner = $('<div>', {'class': 'legend-labels'}).appendTo(target);
    // then add a label and checkbox
    var label = $('<label>').appendTo(inner);
    var input = $('<input>', {
      type: 'checkbox',
      value: status,
      checked: true,
    }).attr('data-layer',`${status}`)
    input.appendTo(label);
    // now add colored circle or line to legend
    var outerSpan = $('<span>').appendTo(label);
    var div = $('<div>', {
      'class': 'circle status' + CONFIG.status_types[status].order,
    }).appendTo(outerSpan);
    // adds text to legend
    var innerSpan = $('<span>', {
      text: ' ' + CONFIG.status_types[status].text
    }).appendTo(outerSpan);
  });

  // iterate TYPE, and create the legend
  items.types.forEach(function(type) {
    var target = $('div.layer-control div#fossil-types div.leaflet-control-layers-overlays');
    // add a wrapper for the legend items
    var inner = $('<div>', {'class': 'legend-labels'}).appendTo(target);
    // then add a label and checkbox
    var label = $('<label>').appendTo(inner);
    var input = $('<input>', {
      type: 'checkbox',
      value: type,
      checked: true,
    }).attr('data-layer',`${type}`)
    input.appendTo(label);
    // now add colored circle or line to legend
    var outerSpan = $('<span>').appendTo(label);
    var div = $('<div>', {
      'class': 'empty ' + CONFIG.fossil_types[type]['symbol'],
    }).appendTo(outerSpan);
    // adds text to legend
    var innerSpan = $('<span>', {
      text: ' ' + CONFIG.fossil_types[type].name
    }).appendTo(outerSpan);
  });

  // show the div.
  $('div.layer-control').show();
}

function drawTable(trackers, title) {
  // update the table name, if provided
  var text = title ? title : CONFIG.default_title;
  $('div#table h3 span').text(text);

  // set up the table column names we want to use in the table
  var columns = $.map(CONFIG.attributes, function(value){ return value; });

  // set up formatted column names for the table
  var names = Object.keys(CONFIG.attributes);
  // don't include column for url; we're going to format this as a link together with the unit name
  var index = $.inArray('url',names);
  columns.splice(index, 1);
  names.splice(index, 1);
  // put table column names into format we need for DataTables
  var colnames = [];
  $.each(columns, function(k, value) {
    // set up an empty object and push a sTitle keys to it for each column title
    var obj = {};
    obj['title'] = value.name;
    colnames.push(obj);
  });
  // set up the table data
  var data = [];
  trackers.forEach(function(tracker) {
    if (! tracker.id) return; // no id = bad data, skip
    // get the properties for each feature
    // var props = tracker.properties;
    // make up a row entry for the table: a list of column values.
    // and copy over all columns from [names] as is to this row
    var row = [];
    $.each(names, function(i,name) {
      // we've already got 'Unit' formatted as a link, above, so skip this here
      if (name=='unit') return;
      row.push(tracker[name]);
    });
    // Add project name as url to the wiki page
    row.splice(1,0,`<a href="${tracker.url}" target="_blank" title="click to open the Wiki page for this project">${tracker.unit}</a>`);
    // when that's all done, push the row as another [] to data
    data.push(row);
  });
  // get the table target from the dom
  var tableElement = $('#table-content table');
  // purge and reinitialize the DataTable instance
  // first time initialization
  if (!CONFIG.table) {
    CONFIG.table = tableElement.DataTable({
      data           : data,
      // include the id in the data, but not searchable, nor displayed
      columnDefs     : [{targets:[0], visible: false, searchable: false}],
      columns        : colnames,
      autoWidth      : true,
      scrollY        : "1px", // initial value only, will be resized by calling resizeTable;
      scrollX        : true,
      lengthMenu     : [50, 100, 500],
      iDisplayLength : 500, // 100 has a noticable lag to it when displaying and filtering; 10 is fastest
      dom            : 'litp',
      deferRender    : true, // default is false
    });

  // every subsequent redraw with new data: we don't need to reinitialize, just clear and update rows
  } else {
    CONFIG.table.clear();
    CONFIG.table.rows.add(data);
    CONFIG.table.search('').draw();
  }

  // finally, set the table title
  var text = typeof name == 'undefined' ? 'All records' : 'Records for ' + name;
  $('#table h2 span').text(text);

}

// update the "results" panel that sits above the map
// this always shows either the Global tally of things, or a country-specific count, or a count from a search term enterd in the "Free Search" input
function updateResultsPanel(data, country=CONFIG.default_title) {
  // update primary content
  $('div#country-results div#results-title h3').text(country);
  var totalrow = $('div#country-results div#total-count').empty();
  var totaltext = data.length > 0 ? (data.length > 1 ? `Tracking ${data.length} coal plants` : `${data.length} fossil project`) : `Nothing found`;
  var total = $('<div>',{text: totaltext}).appendTo(totalrow);

  // not doing anything else here for now...
  // tally results per type of fossil project, and add a row for each if there is more than one
  // var results = $('div#type-count').empty();
  // // for each fossil type, get the count of that type from the data
  // Object.keys(CONFIG.fossil_types).forEach(function(type) {
  //   var count = 0;
  //   data.forEach(function(d) {
  //     if (d.properties.type == type) count += 1;
  //   });
  //   // only show non-zero counts
  //   if (count > 0) {
  //     // format label for type(s) and add to results
  //     var label = CONFIG.fossil_types[type].name;
  //     var html = `${label}<span>${count}</span>`;
  //     $('<div>', {html: html}).appendTo(results);
  //   }
  // });
}

// Reset "button": resets the app to default state
function resetTheMap() {
  // clear anything in the search inputs
  $('form.search-form input').val('');

  // reset map & table display with the default search
  render({ force: true });

  // clear any existing country and feature selection
  CONFIG.selected_country.layer.clearLayers();
  CONFIG.feature_select.clearLayers();
  CONFIG.selected_country.name = '';

  // switch back to the map tab
  $('input#map-tab').click();

  // resize everything
  resize(); 

  // reset the default view
  CONFIG.map.fitBounds(CONFIG.homebounds);
}

// this callback is used when CONFIG.countries is loaded via GeoJSON; see initMap() for details
function massageCountryFeaturesAsTheyLoad(rawdata,feature) {
  // only register hover events for non-touch, non-mobile devices
  // including isMobile() || isIpad() here to include iPad and exclude "other" touch devices here, e.g. my laptop, which is touch, but not mobile
  if (! (isTouch() && ( isMobile() || isIpad() ))) {
    // on mouseover, highlight me; on mouseout quit highlighting
    feature.on('mouseover', function (e) {
      // if we are at a high zoom, don't do anything
      if (CONFIG.map.getZoom() > 9) return;
      // if this country is already 'selected', don't do anything
      var name = this.feature.properties['NAME'];
      if (CONFIG.selected_country.name == name) return;
      // keep a reference to the hovered featured feature
      // and unhighlight other countries that may already be highlighted
      if (name != CONFIG.hovered) CONFIG.countries.setStyle(CONFIG.country_no_style);
      CONFIG.hovered = name;
      // then highlight this country
      this.setStyle(CONFIG.country_hover_style);
    }).on('mouseout', function (e) {
      // on mouseout, remove the highlight, unless
      // a) this country is already "selected" (clicked, see below)
      var name = this.feature.properties['NAME'];
      if (CONFIG.selected_country.name == name) return;
      // b) we are entering one of our map features, i.e. a pipeline, or terminal
      // note: this isn't enough to trap everything, see mouseover() above
      if ( e.originalEvent.toElement && e.originalEvent.toElement.classList.contains('fossil-feature') ) return;
      CONFIG.hovered = '';
      this.setStyle(CONFIG.country_no_style);
    });
  }
  // always register a click event: on click, search and zoom to the selected country
  feature.on('click', clickCountry);
}

// define what happens when we click a country
function clickCountry(e) {
  // clear the search input
  $('form.free-search input').val('');
  // get the name of the clicked country, and keep a reference to it
  var name = e.target.feature.properties['NAME'];
  // if we've clicked an alredy-selected country again, clear the selection, reset the search
  if (CONFIG.selected_country.name == name) {
    CONFIG.selected_country.name = '';
    CONFIG.selected_country.layer.clearLayers();
    render();
  } else {
    CONFIG.selected_country.name = name;
    // highlight it on the map, first clearning any existing selection
    CONFIG.selected_country.layer.clearLayers();
    CONFIG.selected_country.layer.addData(e.target.feature);
    // register the same click event on this layer, as we have for every other country layer
    CONFIG.selected_country.layer.eachLayer(function(layer){
      layer.on('click', clickCountry);
    });
    // call the search function
    searchCountry(name, e.target._bounds);
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// SEARCH FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////////////////////

// searches all data for keyword(s)
function searchMapForText(e) {
  e.preventDefault();
  // get the keywords to search
  var keywords = $('form.free-search input').val();
  // find data matching the keyword
  var results = CONFIG.searchengine.search(keywords);
  // add to the results to map, table, legend
  drawMap(results);                                 // update the map (and legend)
  updateResultsPanel(results, keywords)             // update the results-panel
  drawTable(results, keywords);                     // populate the table
  $('form#nav-table-search input').val(keywords);   // sync the table search input with the keywords
  CONFIG.selected_country.layer.clearLayers();      // clear any selected country
  CONFIG.feature_select.clearLayers();              // clear any selected features
  CONFIG.selected_country.name = '';                // ... and reset the name
  $('div#country-results').show();                  // show the results panel, in case hidden
  $('a.clear-search').show();                       // show the clear search links
  return false;
}

function searchTableForText(e) {
  // get the search text, and update the table name with it
  e.preventDefault();            
  // get the keywords to search
  var keywords = $('form#nav-table-search input').val();
  // update the table name, if provided
  if (keywords) $('div#table h3 span').text(keywords);

  // use DataTables built in search function to search the table with the typed value, and refresh
  CONFIG.table.search(keywords).draw();

  // recalc the map data from the resulting table data
  var data = CONFIG.table.rows({ filter : 'applied'} ).data();
  // pull out the ids to an array, and cast to number
  var ids = data.map(function(row) {return +row[0]});

  // update the map from matching ids
  var data = [];
  DATA.fossil_data.features.forEach(function(d) {
    // cast this id to number as well, because indexOf faster on integers than string
    if (ids.indexOf(+d.properties.id) > -1) data.push(d);
  });
  drawMap(data);                                    // update the map
  $('form.free-search input').val(keywords);        // sync the map search input with the keywords
  CONFIG.feature_select.clearLayers();              // clear any selected map features
  CONFIG.selected_country.layer.clearLayers();      // clear any selected country
  updateResultsPanel(data, keywords);               // update the results panel
  $('a.clear-search').show();                       // show the clear search links
}

// a controller for rendering 'everything'
function render(options) {
  // define the default values
  options.name     = options.name || '';
  options.map      = options.map || true;
  options.results  = options.results  || true;
  options.table    = options.table  || true;
  options.force    = options.force  || false;

  // optionally draw the map (and legend) table, results
  $('div.searchwrapper a.clear-search').hide();
  if (options.map) drawMap(DATA.tracker_data, options.force);
  if (options.results) updateResultsPanel(DATA.tracker_data);
  if (options.table) drawTable(DATA.tracker_data, options.name);
}

// on other applications, this has filtered the data to this country;
// here, we only zoom to the bounds of the country, and continue to show items outside of its boundaries
function searchCountry(name, bounds) {
  // get the data for this country, *only* for updating the results panel
  // the map and table, continue to show all data
  var data = [];
  DATA.fossil_data.features.forEach(function(feature) {
    // look for matching names in feature.properties.countries
    var names = feature.properties.countries.split(',');
    if (names.indexOf(name) > -1) data.push(feature);
  });

  // if bounds were provided, zoom the map to the selected country
  // some countries require special/custom bounds calcs, because they straddle the dateline or are otherwise non-standard
  if (typeof bounds != 'null') {
    switch (name) {
      case 'Russia':
        bounds = L.latLngBounds([38.35400, 24], [78.11962,178]);
        break;
      case 'United States':
        bounds = L.latLngBounds([18.3, -172.6], [71.7,-67.4]);
        break;
      case 'Canada':
        bounds = L.latLngBounds([41.6, -141.0], [81.7,-52.6]);
        break;
      default: break;
    }
    // got bounds, fit the map to it
    CONFIG.map.fitBounds(bounds);
  } // has bounds

  // because we are not filtering the map, but only changing the bounds
  // results on the map can easily get out of sync due to a previous search filter
  // so first we need to explicity render() the map with all data, but not the table or results
  // THEN the table, with all data, but not with this name
  // THEN update results panel for *this* country data only
  // also odd about this approach: this is the only "search" which doesn't update the legend for what you've search for (a country)
  // instead, it shows everything in the legend (since everything IS on the map, but not in the results panel)
  render({ name: name, map:true, results:false, table:false });
  updateResultsPanel(data, name);
  drawTable(DATA.fossil_data.features);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// SHIMS AND UTILITIES: Various polyfills to add functionality
///////////////////////////////////////////////////////////////////////////////////////////////////////////
// trim() function
if(!String.prototype.trim) { String.prototype.trim = function () {return this.replace(/^\s+|\s+$/g,'');};}

// string Capitalize
String.prototype.capitalize = function() { return this.charAt(0).toUpperCase() + this.slice(1);}

// check if a div has a horizontal scrollbar
$.fn.hasHorizontalScrollBar = function() {return this.get(0).scrollWidth > this.get(0).clientWidth; }

// get an object's keys
Object.keys||(Object.keys=function(){"use strict";var t=Object.prototype.hasOwnProperty,r=!{toString:null}.propertyIsEnumerable("toString"),e=["toString","toLocaleString","valueOf","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","constructor"],o=e.length;return function(n){if("object"!=typeof n&&("function"!=typeof n||null===n))throw new TypeError("Object.keys called on non-object");var c,l,p=[];for(c in n)t.call(n,c)&&p.push(c);if(r)for(l=0;o>l;l++)t.call(n,e[l])&&p.push(e[l]);return p}}());

// get a string's Troper Case
String.prototype.toTitleCase=function(){var e,r,t,o,n;for(t=this.replace(/([^\W_]+[^\s-]*) */g,function(e){return e.charAt(0).toUpperCase()+e.substr(1).toLowerCase()}),o=["A","An","The","And","But","Or","For","Nor","As","At","By","For","From","In","Into","Near","Of","On","Onto","To","With"],e=0,r=o.length;r>e;e++)t=t.replace(new RegExp("\\s"+o[e]+"\\s","g"),function(e){return e.toLowerCase()});for(n=["Id","Tv"],e=0,r=n.length;r>e;e++)t=t.replace(new RegExp("\\b"+n[e]+"\\b","g"),n[e].toUpperCase());return t};

// function to indicate whether we are likely being viewed on a touch device
function isTouch() { return !!("ontouchstart" in window) || window.navigator.msMaxTouchPoints > 0; }

// function to detect if we are likely being view on iPad
function isIpad() { return (navigator.userAgent.match(/iPad/i)) && (navigator.userAgent.match(/iPad/i)!= null); }

// variable to show if we are are on a mobile or iPad client
var mobileDetect = new MobileDetect(window.navigator.userAgent);
function isMobile() { return mobileDetect.mobile(); }

// reduce arrays to unique items
const uniq = (a) => { return Array.from(new Set(a));}
