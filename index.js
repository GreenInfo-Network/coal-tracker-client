///////////////////////////////////////////////////////////////////////////////////////////////////////////
// IMPORTS
///////////////////////////////////////////////////////////////////////////////////////////////////////////
const Promise = require('es6-promise-polyfill').Promise;

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
  'hybrid': L.tileLayer('https://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg', { pane: 'hybrid' }),
  'satellite': L.gridLayer.googleMutant({ type: 'satellite', pane: 'satellite' }),
  'basemap' : L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', { attribution: '©OpenStreetMap, ©CARTO', pane: 'basemap' }),
  'labels': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}@2x.png', { pane: 'labels' }),
};

// specify which basemap will be on by default, and when the map is reset by the 'Reset' button
CONFIG.default_basemap = 'basemap';

// default title for results
CONFIG.default_title = 'Worldwide';

// outerring, used for constructing the mask, see searchCountry();
CONFIG.outerring = [[-90,-360],[-90,360],[90,360],[90,-360],[-90,-360]];

// minzoom and maxzoom for the map
CONFIG.minzoom = 2;
CONFIG.maxzoom = 17;

// Style definitions (see also scss exports, which are imported here as styles{})
// a light grey mask covering the entire globe
CONFIG.maskstyle = { stroke: false, fillColor: '#999', fillOpacity: 0.2, className: 'mask' };
// style for highlighting countries on hover and click
CONFIG.country_hover_style    = { stroke: false, fillColor: '#fffef4', fillOpacity: 0.9 };
CONFIG.country_selected_style = { stroke: false, fillColor: '#fff', fillOpacity: 1 };
// an "invisible" country style, as we don't want countries to show except on hover or click
CONFIG.country_no_style = { opacity: 0, fillOpacity: 0 };

// primary attributes to display: used for searching, displaying individual results on map popups, etc.
CONFIG.attributes = {
  'id': {name: 'Tracker ID'},
  'unit': {name: 'Unit'},
  'chinese_name': {name: 'Chinese name'},
  'plant': {name: 'Plant'},
  'url': {name: 'Wiki page'},
  'sponsor': {name: 'Sponsor'},
  'parent': {name: 'Parent'},
  'capacity': {name: 'Capacity (MW)'},
  'status': {name: 'Status'},
  'region': {name: 'Region'},
  'country': {name: 'Country'},
  'subnational': {name: 'Subnational unit (province/state)'},
  'year': {name: 'Start year'},
};


// the Universe of status types: these are the categories used to symbolize coal plants on the map
//          key: allowed status names, matching those used in DATA.fossil_data
//          text: human readible display
//          color: imported from CSS
CONFIG.status_types = {
  'announced': {'id': 0, 'text': 'Announced', 'color': styles.status1 },
  'pre-permit': {'id': 1, 'text': 'Pre-permit', 'color': styles.status2 },
  'permitted': {'id': 2, 'text': 'Permitted', 'color': styles.status3 },
  'construction': {'id': 3, 'text': 'Construction', 'color': styles.status4 },
  'shelved': {'id': 4, 'text': 'Shelved', 'color': styles.status5 },
  'retired': {'id': 5, 'text': 'Retired', 'color': styles.status6 },
  'cancelled': {'id': 6, 'text': 'Cancelled', 'color': styles.status7 },
  'operating': {'id': 7, 'text': 'Operating', 'color': styles.status8 },
  'mothballed': {'id': 8, 'text': 'Mothballed', 'color': styles.status9 },
};

// used to keep a list of markers showing for a particular country or place, by status
// allows us to 'filter' markers, e.g. show/hide using FilterMarkers method added to leaflet.prunecluster.js
// ** IMPORTANT: ensure that these keys match the keys in CONFIG.status_types exactly
// NOTE: Keep in order by status type id (above), otherwise the clusters "pie charts" will not get the correct color
CONFIG.status_markers = {
  'announced': {'markers': []},
  'pre-permit': {'markers': []},
  'permitted': {'markers': []},
  'construction': {'markers': []},
  'shelved': {'markers': []},
  'retired': {'markers': []},
  'cancelled': {'markers': []},
  'operating': {'markers': []},
  'mothballed': {'markers': []},
};

// Note: prunecluster.markercluster.js needs this, and I have not found a better way to provide it
CONFIG.markercluster_colors = Object.keys(CONFIG.status_types).map(function(v) { return CONFIG.status_types[v].color });

// search fields for various categories. These are selected by values keyed select#search-category
CONFIG.search_categories = {
  'all': ['unit', 'plant', 'parent', 'region', 'country', 'subnational', 'year'],
  'unit': ['unit', 'plant'],
  'parent': 'parent',
  'location': ['region', 'country', 'subnational'],
  'year': 'year',
}

// the table columns that the search categories refer to. See searchTableForText()
CONFIG.search_category_columns = {
  'all': [0,4,7,8,9,10],
  'unit': [0],
  'parent': [4],
  'location': [7,8,9],
  'year': [10],
  'status': [6],
}

// the placeholder to show, also depends on the select#search-category selection
CONFIG.search_placeholder = {
  'all': 'project name, company, country',
  'unit': 'unit name, plant name',
  'parent': 'company name',
  'location': 'place name',
  'year': 'year (e.g. 2010)',
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// INITIALIZATION: these functions are called when the page is ready,
///////////////////////////////////////////////////////////////////////////////////////////////////////////
$(document).ready(function () {
  // data initialization first, then the remaining init steps
  Promise.all([initData('./data/trackers.json'), initData('./data/countries.json'), initData('./data/country_lookup.csv')])
    .then(function(data) {
      initDataFormat(data)    // get data ready for use
      initButtons();          // init button listeners
      initTabs();             // init the main navigation tabs. 
      initSearch();           // init the full text search
      initMap();              // regular leaflet map setup
      initTable();            // init the DataTable table
      initMapLayers();        // init some map layers and map feature styles
      initStatusCheckboxes(); // initialize the checkboxes to turn on/off trackers by status
      initPruneCluster();     // init the prune clustering library

      initState();            // init app state given url options

      // ready!
      setTimeout(function () {
        $(window).trigger('resize');
        $('div#pleasewait').hide();
      }, 300);
    }); // Promise.then()
});

// listen for changes to the window size and resize the map
$(window).resize(function() {
  // resize the map, table and content divs to fit the current window
  resize();
  updateSearchBar();
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
  var value = $(window).width() < 768 ? 273 : 265;
  // differential sizing depending on if there is a horizontal scrollbar or not
  if (tablediv.hasHorizontalScrollBar()) value += 10;
  var height = $('body').height() - value;
  // set the scrollbody height via css property
  tablediv.css('height', height);
  CONFIG.table.columns.adjust().draw();
}

function updateSearchBar() {
  var category = $('select#search-category').val();
  var placeholder = CONFIG.search_placeholder[category];
  var search = $('input#mapsearch, input#tablesearch');
  var width = $(window).width();
  if (width < 768) {
    if (search.hasClass('collapsed')) return;
    search.addClass('collapsed');
    setTimeout(function() { search.attr('placeholder','') }, 300);
    search.siblings().find('span.glyphicon-search').on('click', function() {
      search.toggleClass('collapsed');
      if (search.hasClass('collapsed')) {
        setTimeout(function() {
          search.attr('placeholder','');
          search.val('');
        }, 300);
      } else {
        search.attr('placeholder',placeholder);
        search.off('click');
      }
    });
  } else {
    search.removeClass('collapsed');
    search.attr('placeholder',placeholder);
  }
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
  // make a simple lookup from country polygons to our tracker data
  lookup.data.forEach(function(row, i) {
    DATA.country_lookup[row['Name_map']] = row['Name_csv'];
  });

  // keep a reference to the tracker data JSON
  DATA.tracker_data = data[0];
}

// init state from allowed params, or not
function initState() {
  // first check if we are loading from url params or not
  var params = window.location.href;
  // if we have url params, get the params and use them to set state
  if (params.indexOf('?') > -1) {
    // get the params. The only one supported at the moment is "country"
    var params = new URLSearchParams(window.location.search);
    var place = params.get('country');
    if (place) {
      let place_lookup = DATA.country_lookup[place.toTitleCase()];
      // find the country, zoom to it
      CONFIG.countries.eachLayer(function(layer) {
        if (layer.name == place_lookup ) {
          var bounds = layer.getBounds();
          searchCountry(place, bounds, 2000);
          drawTable(DATA.tracker_data);
          highlightCountryLayer(layer.feature);
        }
      })
    } else {
      resetTheMap();
    }
  } else {
    // the default init, if we don't have matching params
    resetTheMap();
  }
}

function initButtons() {
  // "reset" button that resets the map
  $('div a#reset-button').on('click', function(){
    resetTheMap();
  });

  // search icons on the search forms, click to submit
  $('form.search-form span.glyphicon-search').on('click', function() {
    // shouldn't really be needed, since this submits on keyup()
    // and definitely not on mobile, as it interferes with the form exapanding
    if ( !isMobile() ) {
      $(this).closest('form').submit();
    }
  });

  // close button, generically closes it's direct parent
  $('div.close').on('click', function() { $(this).parent().hide(); });

  // init the menu icon to open the "results" panel
  $('div#results-icon').on('click', function() { $('div#country-results').show(); });

  // the clear search button, clears the search input
  $('div.searchwrapper a.clear-search').on('click', function() {
    $(this).siblings('input').val('').trigger('keyup');
    $(this).hide();
  });

  // init the zoom button that shows on the modal details for an individual coal plant
  $('#btn-zoom').click(function(){
    var target = this.dataset.zoom.split(',');
    var latlng = L.latLng([target[0], target[1]]);
    var zoom = 16;

    // remove current basemap
    removeCurrentBasemap();
    // add google satellite basemap
    CONFIG.map.addLayer(CONFIG.basemaps['satellite']);
    // ...and keep the radio button in sync with the map
    $('#layers-base input[data-baselayer="satellite"]').prop('checked', true);

    // remove any country "highlight" and select effect, as this will block the map
    CONFIG.countries.setStyle(CONFIG.country_no_style);
    CONFIG.selected_country.name = '';
    CONFIG.selected_country.layer.clearLayers();

    // add the back button, which takes the user back to previous view (see function goBack() defined in the construction of Leaflet control)
    // but only if there is not already a back button on the map
    CONFIG.oldbounds = CONFIG.map.getBounds();
    if ($('.btn-back').length == 0) CONFIG.back.addTo(CONFIG.map);

    // move and zoom the map to the selected unit
    CONFIG.map.setView(latlng, zoom);
  });

  // a leaflet control to take the user back to where they came
  // Only visible when zooming to an individual plant from the dialog popup. See $('#btn-zoom').click()
  L.backButton = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: function (map) {
      var container   = L.DomUtil.create('div', 'btn btn-primary btn-back', container);
      container.title = 'Click to go back to the previous view';
      this._map       = map;

      // generate the button
      var button = L.DomUtil.create('a', 'active', container);
      button.control   = this;
      button.href      = 'javascript:void(0);';
      button.innerHTML = '<span class="glyphicon glyphicon-chevron-left"></span> Go back to country view';

      L.DomEvent
        .addListener(button, 'click', L.DomEvent.stopPropagation)
        .addListener(button, 'click', L.DomEvent.preventDefault)
        .addListener(button, 'click', function () {
          this.control.goBack();
        });

      // all set, L.Control API is to return the container we created
      return container;
    },

    // the function called by the control
    goBack: function () {
      // set the map to the previous bounds
      CONFIG.map.fitBounds(CONFIG.oldbounds);

      // remove current basemap
      removeCurrentBasemap();
      // add the plain basemap - we could try to keep track of which basemap the user
      // was on before zooming in - but what if they zoom in to another? then the current
      // basemap becomes satellite - and tracking all this gets ridiculous
      CONFIG.map.addLayer(CONFIG.basemaps['basemap']);

      // keep the radio button in sync with the map
      $('#layers-base input[data-baselayer="basemap"]').prop('checked', true);

      // remove the back button
      CONFIG.back.remove(CONFIG.map);
    }
  });

  // select all/none by status
  $('div#layer-control-clear span#select-all').on('click', function(e) {
    $('div#status-layers input:not(:checked)').each(function(c) { $(this).click() });
    return false;
  });
  $('div#layer-control-clear span#clear-all').on('click', function(e) {
    $('div#status-layers input:checked').each(function(c) { $(this).click() });
    return false;
  });
}

// initialize the map in the main navigation map tab
function initMap() {
  // basic leaflet map setup
  CONFIG.map = L.map('map', {
    attributionControl:false,
    zoomControl: false,
    minZoom: CONFIG.minzoom, maxZoom: CONFIG.maxzoom,
    attributionControl: false,
  });

  // add zoom control, top right
  L.control.zoom({
    position:'topright'
  }).addTo(CONFIG.map);

  // map panes
  // - create panes for basemaps
  CONFIG.map.createPane('basemap');
  CONFIG.map.getPane('basemap').style.zIndex = 300;
  CONFIG.map.getPane('basemap').style.pointerEvents = 'none';
  CONFIG.map.createPane('hybrid');
  CONFIG.map.getPane('hybrid').style.zIndex = 301;
  CONFIG.map.getPane('hybrid').style.pointerEvents = 'none';
  CONFIG.map.createPane('satellite');
  CONFIG.map.getPane('satellite').style.zIndex = 302;
  CONFIG.map.getPane('satellite').style.pointerEvents = 'none';
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
  CONFIG.map.createPane('feature-pane');
  CONFIG.map.getPane('feature-pane').style.zIndex = 550;

  // add attribution
  var credits = L.control.attribution().addTo(CONFIG.map);
  credits.addAttribution('Interactive mapping by <a href="http://greeninfo.org" target="_blank">GreenInfo Network</a>. Data: <a href="https://globalenergymonitor.org/" target="_blank">Global Energy Monitor</a>');

  // Add a feature group to hold the mask, essentially a grey box covering the world minus the country in the view
  CONFIG.mask = L.featureGroup([L.polygon(CONFIG.outerring)], {pane: 'country-mask' }).addTo(CONFIG.map);
  CONFIG.mask.setStyle(CONFIG.maskstyle);

  // Add a layer to hold countries, for click and hover (not mobile) events on country features
  CONFIG.countries = L.featureGroup([], { pane: 'country-hover' }).addTo(CONFIG.map);
  L.geoJson(DATA.country_data,{ style: CONFIG.country_no_style, onEachFeature: massageCountryFeaturesAsTheyLoad });

  // add a layer to hold any selected country
  CONFIG.selected_country = {};
  CONFIG.selected_country.layer = L.geoJson([], {style: CONFIG.country_selected_style, pane: 'country-select'}).addTo(CONFIG.map);

  // add a feature group to hold the clusters
  CONFIG.cluster_layer = L.featureGroup([], {pane: 'feature-pane' }).addTo(CONFIG.map);

  // once the map is done loading, resize
  CONFIG.map.on('load', function() {
    resize();
    CONFIG.map.invalidateSize();
  });

  // create an instance of L.backButton()
  CONFIG.back = new L.backButton() // not added now, see initButtons()

  // zoom listeners
  CONFIG.map.on('zoomend', function() {
    let zoom = CONFIG.map.getZoom();
  });

}

function initMapLayers() {
  // on startup, add the basemap and labels
  CONFIG.map.addLayer(CONFIG.basemaps.basemap);
  CONFIG.map.addLayer(CONFIG.basemaps.labels);

  // set listener on radio button change to change to the selected basemap
  // and also control whether or not the mask is showing
  $('#layers-base input').change(function() {
    var selected = $(this).data().baselayer;
    // remove current basemap and labels
    removeCurrentBasemap();
    // add selected basemap and labels, if necessary
    CONFIG.map.addLayer(CONFIG.basemaps[selected]);
    if (selected == 'basemap') CONFIG.map.addLayer(CONFIG.basemaps.labels);

    // make room for the attribution
    if (selected == 'satellite') {
      $('div.layer-control[data-panel="layers"]').css('bottom', '42px');
    } else {
      $('div.layer-control[data-panel="layers"]').css('bottom', '22px');
    }

  });
}

// set listener on checkboxes to turn on/off trackers by status, and update the clusters
function initStatusCheckboxes() {
  $('div.layer-control').on('change', '#status-layers input', function() {
    var status = $(this).val();
    // 1) update the markers on the map
    var markers = CONFIG.status_markers[status].markers;
    CONFIG.clusters.FilterMarkers(markers, !$(this).prop('checked')); // false to filter on, true to filter off :)
    CONFIG.clusters.ProcessView();

    // 2) update the rows shown on the table
    let statuses = [];
    $('div.layer-control div#status-layers input:checked').each(function(l) { 
      statuses.push(this.value);
    });
    // let 
    var data = DATA.tracker_data.filter(function(d) {
      return statuses.indexOf(d.status) > -1
    })
    drawTable(data, 'Status filtered');

    // 3) update the "results" panel
    updateResultsPanel(data, 'Status filtered');
  });
}

// init the data table, but don't populate it, yet
function initTable() {
  // set up the table column names we want to use in the table
  var columns = $.map(CONFIG.attributes, function(value){ return value; });
  
  // set up formatted column names for the table
  var names = Object.keys(CONFIG.attributes);
  // don't include column for url; we're going to format this as a link together with the unit name
  var index = $.inArray('url',names);
  columns.splice(index, 1);
  names.splice(index, 1);
  CONFIG.table_names = names;

  // put table column names into format we need for DataTables
  var colnames = [];
  $.each(columns, function(k, value) {
    // set up an empty object and push a sTitle keys to it for each column title
    var obj = {};
    obj['title'] = value.name;
    colnames.push(obj);
  });
  // initialize and keep a reference to the DataTable
  CONFIG.table = $('#table-content table').DataTable({
    data           : [],
    // include the id in the data, but not searchable, nor displayed
    columnDefs     : [{targets:[0], visible: false, searchable: false}],
    columns        : colnames,
    autoWidth      : true,
    scrollY        : "1px", // initial value only, will be resized by calling resize();
    scrollX        : true,
    lengthMenu     : [50, 100, 500],
    iDisplayLength : 100, // 100 has a noticable lag to it when displaying and filtering; 10 is fastest
    dom            : 'litp',
    deferRender    : true, // default is false
  });
} // init table

// initialize the nav tabs: what gets shown, what gets hidden, what needs resizing, when these are displayed
// important: to add a functional tab, you must also include markup for it in css, see e.g. input#help-tab:checked ~ div#help-content {}
function initTabs()    {
  $('input.tab').on('click', function(e) {
    // get the type from the id
    var type = e.currentTarget.id.split("-")[0];
    switch (type) {
      case 'map':
        CONFIG.map.invalidateSize(false);
        $('form.search-form').show();
        break;
      case 'table':
        $('form.search-form').show();
        resize();
        break;
      default:
        // hide search form
        $('form.search-form').hide();
        break;
    }
  });
}

// Init search for matching keywords entered in the input at top-right
// we use ElasticLunr (https://github.com/weixsong/elasticlunr.js) as the search "engine"
function initSearch() {
  // config search engine with the fields and data to be searched
  // which end up searched depends on selections made in select#search-categories and implemented at run time
  // CONFIG.searchengine = elasticlunr(function () {
  //   this.addField('sponsor');
  //   this.addField('parent');
  //   this.addField('unit');
  //   this.addField('plant');
  //   this.addField('country');
  //   this.addField('region');
  //   this.addField('subnational');
  //   this.addField('year');
  //   this.setRef('id');
  // });
  // DATA.tracker_data.forEach(function(document) {
  //   CONFIG.searchengine.addDoc(document);
  // })

  CONFIG.searchengine = new FlexSearch({
      tokenize: 'strict',
      depth: 3,
      doc: {
          id: 'id',
          field: [
            'sponsor',
            'parent',
            'unit',
            'plant',
            'country',
            'region',
            'subnational',
            'year'
          ]
      }
  });
  CONFIG.searchengine.add(DATA.tracker_data);
  window.searchengine = CONFIG.searchengine;

  // update the placeholder text when search category is selected
  $('select#search-category').on('change', function() {
    let value = $(this).val();
    let placeholder = CONFIG.search_placeholder[value];
    // clear any search string on the search and update the placeholder
    $('input#mapsearch, input#tablesearch').attr('placeholder', placeholder);
  });

  // init the "map search" form input itself
  $('form#search input').keyup(_.debounce(function() {
    // if the input is cleared, redo the 'everything' search (e.g. show all results)
    // this is distinct from the case of "No results", in searchForText
    if (!this.value) return render();
    // otherwise, just trigger the search
    $(this).submit();
  },300));

  $('form#search').submit(function(e) {
    // prevent default, and return early if we submitted an empty form
    e.preventDefault();
    if (! $('form#search input#mapsearch').val()) return;

    // search the map, and that process will update the table
    searchForText();
  })

}

// initialize the PruneClusters, and override some factory methods
function initPruneCluster() {
  // create a new PruceCluster object, with a minimal cluster size of (30)
  // updated arg to 30; seems to really help countries like China/India
  CONFIG.clusters = new PruneClusterForLeaflet(30);
  CONFIG.map.addLayer(CONFIG.clusters);

  // this is from the categories example; sets ups cluster stats used to derive category colors in the clusters
  CONFIG.clusters.BuildLeafletClusterIcon = function(cluster) {
    var e = new L.Icon.MarkerCluster();
    e.stats = cluster.stats;
    e.population = cluster.population;
    return e;
  };

  var pi2 = Math.PI * 2;

  L.Icon.MarkerCluster = L.Icon.extend({
    options: {
      iconSize: new L.Point(22, 22),
      className: 'prunecluster leaflet-markercluster-icon'
    },

    createIcon: function () {
      // based on L.Icon.Canvas from shramov/leaflet-plugins (BSD licence)
      var e = document.createElement('canvas');
      this._setIconStyles(e, 'icon');
      var s = this.options.iconSize;
      e.width = s.x;
      e.height = s.y;
      this.draw(e.getContext('2d'), s.x, s.y);
      return e;
    },

    createShadow: function () {
      return null;
    },

    draw: function(canvas, width, height) {
      // the pie chart itself
      var start = 0;
      for (var i = 0, l = CONFIG.markercluster_colors.length; i < l; ++i) {
        // the size of this slice of the pie
        var size = this.stats[i] / this.population;
        if (size > 0) {
          canvas.beginPath();
          canvas.moveTo(11, 11);
          canvas.fillStyle = CONFIG.markercluster_colors[i];
          // start from a smidgen away, to create a tiny gap, unless this is a single slice pie
          // in which case we don't want a gap
          var gap = size == 1 ? 0 : 0.15
          var from = start + gap;
          var to = start + size * pi2;

          if (to < from) {
            from = start;
          }
          canvas.arc(11,11,11, from, to);
          start = start + size*pi2;
          canvas.lineTo(11,11);
          canvas.fill();
          canvas.closePath();
        }
      }

      // the white circle on top of the pie chart, to make the middle of the "donut"
      canvas.beginPath();
      canvas.fillStyle = 'white';
      canvas.arc(11, 11, 7, 0, Math.PI*2);
      canvas.fill();
      canvas.closePath();

      // the text label count
      canvas.fillStyle = '#555';
      canvas.textAlign = 'center';
      canvas.textBaseline = 'middle';
      canvas.font = 'bold 9px sans-serif';

      canvas.fillText(this.population, 11, 11, 15);
    }
  });

  // we override this method: don't force zoom to a cluster on click (the default)
  CONFIG.clusters.BuildLeafletCluster = function (cluster, position) {
    var _this = this;
    var m = new L.Marker(position, {
      icon: this.BuildLeafletClusterIcon(cluster)
    });
    // this defines what happen when you click a cluster, not the underlying icons
    m.on('click', function () {
      var markersArea = _this.Cluster.FindMarkersInArea(cluster.bounds);
      var b = _this.Cluster.ComputeBounds(markersArea);
      if (b) {
        // skip the force zoom that is here by default, instead, spiderfy the overlapping icons
        _this._map.fire('overlappingmarkers', { cluster: _this, markers: markersArea, center: m.getLatLng(), marker: m });
      }
    });
    return m;
  }

  // we override this method to handle clicks on individual plant markers (not the clusters)
  CONFIG.clusters.PrepareLeafletMarker = function(leafletMarker, data){
    var html = `<div style='text-align:center;'><strong>${data.title}</strong><br><div class='popup-click-msg'>Click the circle for details</div></div>`;
    leafletMarker.bindPopup(html);
    leafletMarker.setIcon(data.icon);
    leafletMarker.attributes = data.attributes;
    leafletMarker.coordinates = data.coordinates;
    leafletMarker.on('click',function () {
      openTrackerInfoPanel(this);
    });
    leafletMarker.on('mouseover', function() {
      this.openPopup();
    });
    leafletMarker.on('mouseout', function() { CONFIG.map.closePopup(); });
  }

  // A convenience method for marking a given feature as "filtered" (e.g. not shown on the map and removed from a cluster)
  CONFIG.clusters.FilterMarkers = function (markers, filter) {
    for (var i = 0, l = markers.length; i < l; ++i) {
      // false to add, true to remove
      markers[i].filtered = filter;
    }
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// Named functions
///////////////////////////////////////////////////////////////////////////////////////////////////////////

// Set up all map layers for all types and statuses, and set up layer objects in CONFIG.status_types['layers'], so we can turn them on and off later.
function drawMap(data, force_redraw=false, fitbounds=true) {
  // step 1: clear the marker clustering system and repopulate it with the current set of tracker points
  // as we go through, log what statuses are in fact seen; this is used in step 5 to show/hide checkboxes for toggling trackers by status
  var statuses   = [];
  var trackers   = [];
  data.forEach(function (tracker) {
    var status = tracker.status;
    if (status) {
      // log that this status has been seen, see step 3 below
      if (statuses.indexOf(status) < 0) statuses.push(status);
      // add the feature to the trackers list for the table
      trackers.push(tracker);
    }
  });
  // step 2: update the marker clustering, now that "trackers" is implicitly filtered to everything that we need
  updateClusters(trackers, fitbounds);

  // step 3: hide the status toggle checkboxes, showing only the ones which in fact have a status represented
  drawLegend(statuses);
}

function updateClusters(data, fitbounds) {
  // start by clearing out existing clusters
  CONFIG.clusters.RemoveMarkers();

  // iterate over the data and set up the clusters
  data.forEach(function(feature) {
    // the "status" of the tracker point affects its icon color
    // and also its membership in CONFIG.status_markers for per-status filtering
    var status = feature.status;
    var statusId = CONFIG.status_types[status]['id'];
    var cssClass = `status${statusId + 1}`;
    var marker = new PruneCluster.Marker(parseFloat(feature.lat), parseFloat(feature.lng), {
      title: feature.unit,
      icon: L.divIcon({
          className: 'circle-div ' + cssClass, // Specify a class name we can refer to in CSS.
          iconSize: [15, 15] // Set the marker width and height
        })
    });

    // get the attributes for use in the custom popup dialog (see openTrackerInfoPanel())
    marker.data.attributes = feature;

    // get the lat-lng now so we can zoom to the plant's location later
    // getting the lat-lng of the spider won't work, since it gets spidered out to some other place
    // tip: the raw dataset is lng,lat and Leaflet is lat,lng
    marker.data.coordinates = [ feature.lat, feature.lng ];

    // set the category for PruneCluster-ing
    marker.category = parseInt(statusId);

    // These have all defaulted to visible for a long time now... do we need this??
    // furthermore, if the marker shouldn't be visible at first, filter the marker by setting the filtered flag to true (=don't draw me)
    // if (!CONFIG.status_types[status].visible) marker.filtered = true;

    // register the marker for PruneCluster clustering
    CONFIG.clusters.RegisterMarker(marker);

    // also add the marker to the list by status, so we can toggle it on/off in the legend
    // see CONFIG.map.on('overlayadd') and CONFIG.map.on('overlayremove')
    CONFIG.status_markers[status].markers.push(marker);
  });
  // all set! process the view, and fit the map to the new bounds
  CONFIG.clusters.ProcessView();
  var cluster_bounds = CONFIG.clusters.Cluster.ComputeGlobalBounds();
  if (cluster_bounds) {
    var bounds = [[cluster_bounds.minLat, cluster_bounds.minLng],[cluster_bounds.maxLat, cluster_bounds.maxLng]];
  } else {
    // we have no clusters (empty result)!
    bounds = CONFIG.homebounds;
  }
  // fit the map to the bounds, if instructed
  if (fitbounds) {
    // timeout appears necessary to let the clusters do their thing, before fitting bounds
    setTimeout(function() {
      // typically we'll just do this (e.g. on search)
      CONFIG.map.fitBounds(bounds);

      // first load: a trick to always fit the bounds in the map, see #20
      if (! CONFIG.homebounds) {
        let center = CONFIG.map.getCenter();
        let zoom = CONFIG.map.getBoundsZoom(bounds, true); // finds the zoom where bounds are fully contained
        CONFIG.map.setView([center.lat, center.lng], zoom);
        CONFIG.map.once("moveend zoomend", function() {
          // wait til this animation is complete, then set homebounds, if it hasn't been set yet (or do nothing if it has)
          CONFIG.homebounds = CONFIG.homebounds || CONFIG.map.getBounds();
        });
      }
    }, 200)
  }
}
// show and hide the correct legend labels and checkboxes for this set of data and statuses
// "statuses" comes from the data search itself
function drawLegend(statuses) {
  $('#status-layer-wrapper').show();
  var target = $('#status-layers').html(''); // clear existing html
  statuses.forEach(function(status) {
    var label = $('<label>');
    var input = $('<input>', {
      type: 'checkbox',
      value: status
    }).attr('checked','checked');
    input.appendTo(label);

    var container = $('<span>', {'class': 'legend-container'}).appendTo(label);
    // adds colored circle to legend
    var div = $('<div>', {
      style: 'background:' + CONFIG.status_types[status].color,
      'class': 'circle'
    }).appendTo(container);
    // adds text to legend
    var innerSpan = $('<span>', {
      text: ' ' + CONFIG.status_types[status].text
    }).appendTo(container);

    label.appendTo(target);
  });
}

// update the DataTable
function drawTable(trackers, title) {
  // set up the table data
  var data = [];
  trackers.forEach(function(tracker) {
    // make up a row entry for the table: a list of column values.
    // and copy over all columns from [CONFIG.table_names] as is to this row
    var row = [];
    $.each(CONFIG.table_names, function(i,name) {
      // we've already got 'Unit' formatted as a link, above, so skip this here
      if (name=='unit') return;
      row.push(tracker[name]);
    });
    // Add project name as url to the wiki page
    row.splice(1,0,`<a href="${tracker.url}" target="_blank" title="click to open the Wiki page for this project">${tracker.unit}</a>`);
    // when that's all done, push the row as another [] to data
    data.push(row);
  });

  // purge and reinitialize the DataTable instance
  CONFIG.table.clear();
  CONFIG.table.rows.add(data);
  CONFIG.table.search('').draw();

  // update the table name, if provided
  var text = title ? title : CONFIG.default_title;
  $('div#table h3 span').text(text);
}

// update the "results" panel that sits above the map
// this always shows either the Global tally of things, or a country-specific count, or a count from a search term enterd in the "Free Search" input
function updateResultsPanel(data, country=CONFIG.default_title) {
  // update primary content
  $('div#country-results div#results-title h3').text(country);
  var totalrow = $('div#country-results div#total-count').empty();
  var totaltext = data.length > 0 ? (data.length > 1 ? `Tracking ${data.length.toLocaleString()} coal-fired units` : `Tracking ${data.length} coal project`) : `Nothing found`;
  var total = $('<div>',{text: totaltext}).appendTo(totalrow);
}

// when user clicks on a coal plant point, customize a popup dialog and open it
function openTrackerInfoPanel(feature) {
  // get the features properties, i.e. the data to show on the modal
  var properties = feature.attributes;
  // get the popup object itself and customize
  var popup = $('#tracker-modal');
  // go through each property for this one feature, and write out the value to the correct span, according to data-name property
  $.each(properties, function(dataname, value) {
    // get preferred text for each status types
    if (dataname == 'status') value = CONFIG.status_types[value].text;
    // write the status name to the dialog
    $('#tracker-modal .modal-content span').filter('[data-name="' + dataname + '"]').text(value);
  })

  // wiki page needs special handling to format as <a> link
  var url = properties['url'];
  var wiki = $('#tracker-modal .modal-content span').filter('[data-name="wiki_page"]').text('');
  $('<a>', { text: url, href: url, target: "_blank"} ).appendTo(wiki);

  // format the zoom-to button data.zoom attribute. See initZoom();
  // this lets one zoom to the location of the clicked plant
  var zoomButton = $('#btn-zoom');
  zoomButton.attr('data-zoom', feature.attributes.lat + "," + feature.attributes.lng);

  // all set: open the dialog
  popup.modal();
}

// Reset "button": resets the app to default state
function resetTheMap() {
  // clear anything in the search inputs
  $('form.search-form input').val('');

  // reset map & table display with the default search
  // If we have a homebounds defined, that means we've been here before, and have rendered the full data to the map.
  if (CONFIG.homebounds) {
    // use homebounds we already defined
    render({ force_redraw: true, fitbounds: false });
    CONFIG.map.fitBounds(CONFIG.homebounds);
  } else {
    // first time through, let this function do the map fitting and set CONFIG.homebounds
    render({ force_redraw: true });
  }

  // clear any existing country and feature selection
  CONFIG.selected_country.layer.clearLayers();
  CONFIG.selected_country.name = '';

  // switch back to the map tab
  $('input#map-tab').click();

  // resize everything
  resize();
}

// this callback is used when CONFIG.countries is loaded via GeoJSON; see initMap() for details
function massageCountryFeaturesAsTheyLoad(rawdata,feature) {
  // attach some attributes
  feature.name = rawdata.properties['NAME'];

  // only register hover events for non-touch, non-mobile devices
  // including isMobile() || isIpad() here to include iPad and exclude "other" touch devices here, e.g. my laptop, which is touch, but not mobile
  if (! (isTouch() && ( isMobile() || isIpad() ))) {
    // on mouseover, highlight me; on mouseout quit highlighting
    feature.on('mouseover', function (e) {
      // if we are at a high zoom, don't do anything
      if (CONFIG.map.getZoom() > 7) return;
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
      // this country is already "selected" (clicked, see below)
      var name = this.feature.properties['NAME'];
      if (CONFIG.selected_country.name == name) return;
      this.setStyle(CONFIG.country_no_style);
    });
  }
  // at lower zooms, register a click event: on click, search and zoom to the selected country
  feature.on('click', clickCountry);

  // finally add this individual country feature to CONFIG.countries
  // CONFIG.countries.addLayer(feature);
  feature.addTo(CONFIG.countries);
}

// define what happens when we click a country
function clickCountry(e) {
  // exit early if we are at high zoom
  if (CONFIG.map.getZoom() > 7) return;
  // clear the map search input
  $('form#search input').val('');
  // get the name of the clicked country, and keep a reference to it
  var name = e.target.feature.properties['NAME'];
  CONFIG.selected_country.name = name;
  highlightCountryLayer(e.target.feature);
  // call the search function
  searchCountry(name, e.target._bounds);
}

function highlightCountryLayer(feature) {
  // highlight it on the map, first clearning any existing selection
  CONFIG.selected_country.layer.clearLayers();
  CONFIG.selected_country.layer.addData(feature);
}

// remove the current basemap from the view
function removeCurrentBasemap() {
  Object.keys(CONFIG.basemaps).forEach(function(basemap) {
    CONFIG.map.removeLayer(CONFIG.basemaps[basemap]);
    CONFIG.map.removeLayer(CONFIG.basemaps.labels);
  });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// SEARCH FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////////////////////

// searches all data for keyword(s)
function searchForText() {
  // get the keywords to search
  var query = $('form#search input#mapsearch').val();

  // Kick off a search to find data matching the keyword, and pull out the results
  // initial config:
  // - combine search terms with 'AND' ('OR' is the default)
  // - expand tokens, to better match substrings (default is false, to emphasize whole words)
  // let options = {bool: 'AND', expand: true};
  // extract the fields to search, from the selected 'search category' options
  let category = $('select#search-category').val();
  // options['fields'] = CONFIG.search_categories[category];
  // var search_results = CONFIG.searchengine.search(keywords, options);
  // var results = [];

  var results = CONFIG.searchengine.search({
    field: CONFIG.search_categories[category],
    // bool: CONFIG.search_categories[category].length == 1 ? 'and' : 'or',
    suggest: true,
    query: query,
  });


        var suggestions = $('div#suggestions').empty();
        if (category == 'parent') {
          suggestions.show();
          var companies = _.uniq(_.map(results, 'parent'));
          companies.forEach(function(company) {
              var entry = $('<div>', {text: company}).appendTo(suggestions);
              entry.mark(query);
          });

        }



// debugger;
            // // var first_result = data[results[0]];
            // var autocomplete = document.getElementById("autocomplete");
            // var first_result = results[0].parent;
            // var match = first_result && first_result.toLowerCase().indexOf(query.toLowerCase());

            // if(first_result && (match !== -1)){
            //     console.log('here')
            //     autocomplete.value = query + first_result.substring(match + query.length);
            //     autocomplete.current = first_result;
            // }
            // else{

            //     autocomplete.value = autocomplete.current = query;
            // }


  // add to the results to map, table, legend
  drawMap(results);                              // update the map (and legend)
  updateResultsPanel(results, query)             // update the results-panel
  drawTable(results, query);                     // populate the table
  $('form#nav-table-search input').val(query);   // sync the table search input with the query
  CONFIG.selected_country.layer.clearLayers();   // clear any selected country
  CONFIG.selected_country.name = '';             // ... and reset the name
  $('div#country-results').show();               // show the results panel, in case hidden
  $('a.clear-search').show();                    // show the clear search links

  return false;
}

// The primary controller for rendering things
function render(options) {
  if (options === undefined) options = {};
  // If defined, take as given, otherwise, assign the default value as stated
  options.name          = options.name         !== undefined ? options.name : CONFIG.default_title;
  options.map           = options.map          !== undefined ? options.map : true;
  options.results       = options.results      !== undefined ? options.results : true;
  options.table         = options.table        !== undefined ? options.table : true;
  options.force_redraw  = options.force_redraw !== undefined ? options.force_redraw : false;
  options.fitbounds     = options.fitbounds    !== undefined ? options.fitbounds : true;

  // optionally draw the map (and legend) table, results
  $('div.searchwrapper a.clear-search').hide();
  if (options.map)     drawMap(DATA.tracker_data, options.force_redraw, options.fitbounds);
  if (options.results) updateResultsPanel(DATA.tracker_data);
  if (options.table)   drawTable(DATA.tracker_data, options.name);
}

// zoom to the bounds of the country, and continue to show items outside of its boundaries
function searchCountry(name, bounds, delay=1) {
  // get the data for this country, *only* for updating the results panel
  // the map and table, continue to show all data
  var data = [];
  // translate from the country data names to our tracker data names, then look for matches
  var name = DATA.country_lookup[name];
  DATA.tracker_data.forEach(function(feature) {
    // look for matching names in feature.properties.countries
    if (name == feature.country) data.push(feature);
  });

  // because we are not filtering the map, but only changing the bounds
  // results on the map can easily get out of sync due to a previous search filter
  // so first we need to explicity render() the map with all data, but not the table or results
  render({ name: name, map: true, results: false, table: false, fitbounds: false });
  // THEN update results panel for *this* country data only
  updateResultsPanel(data, name);
  // THEN the table, with all data, but not with this name
  // may seem superfluous, but important to keep the map/table in sync, and showing all data
  drawTable(DATA.tracker_data);

  // Last step: zoom the map to the selected country
  // some countries require special/custom bounds calcs, because they straddle the dateline or are otherwise non-standard
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
    default:
      break;
  }
  setTimeout(function() {
    CONFIG.map.fitBounds(bounds);
  }, delay)
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

// variable to show if we are are on a device with a small window
function isMobile() { return $(window).width() < 768 }

// reduce arrays to unique items
const uniq = (a) => { return Array.from(new Set(a));}
