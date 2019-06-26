///////////////////////////////////////////////////////////////////////////////////
// IMPORTS
///////////////////////////////////////////////////////////////////////////////////
const Promise = require('es6-promise-polyfill').Promise;
import MobileDetect from 'mobile-detect';

// const PruneClusterForLeaflet = require('./libs/leaflet.prunecluster.js');
// require('./libs/leaflet.prunecluster.markercluster.js');

///////////////////////////////////////////////////////////////////////////////////
// STYLES, in production, these will be written to <script> tags
///////////////////////////////////////////////////////////////////////////////////
// import './loading.css';
import styles from './index.scss';

///////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARIABLES & STRUCTURES
///////////////////////////////////////////////////////////////////////////////////
// global config
const CONFIG = {};
const DATA = {};



///////////////////////////////////////////////////////////////////////////////////
///// GLOBAL VARIABLES & STRUCTURES
///////////////////////////////////////////////////////////////////////////////////

// the Leaflet L.map object and friends (see initMap();)
var MAP, MASK, CURRENT_BASEMAP, COUNTRIES, DATA_COUNTRIES, BACK_BUTTON, CLUSTERS;

// outerring, used for constructing the mask, see searchCountry();
var OUTERRING = [ [-90, -360],[-90, 360],[90, 360],[90, -360],[-90,-360] ];
// basemap definitions
// see also the L.basemapSwitcherControl custom Leaflet control, which uses this to show/hide the appropriate basemap
// and note that the HTML in this control is contrived to match these BASEMAPS offerings
var BASEMAPS = {
    'hybrid' : L.tileLayer('https://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg', { zIndex:1 }),
    'satellite' : new L.Google(),
    'basemap' : L.tileLayer('https://{s}.tiles.mapbox.com/v3/greeninfo.map-jn70s6ih/{z}/{x}/{y}.jpg', { zIndex:1 })
};

// the starting view: bounds, see initMap()
var HOMEBOUNDS = L.latLngBounds([51.069, 110.566], [-36.738,-110.566]);
var MAPBOUNDS = HOMEBOUNDS;
// minzoom and maxzoom for the map
var MINZOOM = 2;
// mapbox satellite at best goes to 19 (for US), 16 or 17 everywhere else
// see initMap(), and MAP.on('zoomend'): we switch basemap to google at high zoom
var MAXZOOM = 20;

// bing key for geocoding
var BING_API_KEY = "AjBuYw8goYn_CWiqk65Rbf_Cm-j1QFPH-gGfOxjBipxuEB2N3n9yACKu5s8Dl18N";

// some color constants
// for selected countries:
var COUNTRY_SELECT_STYLE = {color: '#ff7800', weight: 1};
// style for the mask: highlights country by adding opaque layer 'outside' country poly
var MASKSTYLE = { stroke: 13, color: '#fff', opacity: 0.2, fillColor: '#888', fillOpacity: 0.4 };
// COUNTRY AND HIGHLIGHT_COUNTY map style constants
// style for highlighting countries on mouseover
var HIGHLIGHT_STYLE = { 'stroke': false, 'fillColor': '#fff', 'fillOpacity': 0.22 };
// an 'invisible' map style, as we don't want countries to show except on query or mouseover
var INVISIBLE_STYLE = { 'opacity': 0, 'fillOpacity': 0 };

// default set of column names, in print format and as they are in the data
// these are also defined in the trackers model; could be useful in the future for server-side requests
// at the moment, everything comes in through geojson; see README.txt (countries.json, trackers.json)
// if adding a column to the table or popup view, make sure the field is a) added here, b) included in the trackers.json export (see README.txt), and c) stub out html for the new field in the table and the popup
var COLUMN_NAMES = {
    'Unit': 'unit',
    'Plant': 'plant',
    'Other names': 'other_names',
    'Wiki Page': 'wiki_page',
    'Sponsor': 'sponsor',
    'Capacity (MW)': 'capacity_mw',
    'Status': 'status',
    'Region': 'region',
    'Country': 'country',
    'Subnational unit': 'subnational_unit',
};

// used in datatables search by column; see tableSeaarch()
// if column positions change, be sure to update these values so that search continues to search the correct column
var REGION_COLUMN_POS = 6;
var COUNTRY_COLUMN_POS = 7;
var SUBNATIONAL_COLUMN_POS = 8;
var RECORDS_TEXT = 'Records for ';

// default set of regions/countires.
// this is a useful query to help build this list from the trackers table: SELECT region, string_agg(DISTINCT(country), ';') FROM trackers GROUP BY region
// note, we also build the form selects from this object, see initMapForm();
// separating entries by ';' so we can include commas for 'Central America, Mexico...''
// * important: ensure there are no spaces between ;'s, since these are matched exactly
// TO DO: derive these from data, not this list (means getting countries json from a complete matching dataset)
var REGION_COUNTRIES = {
 'Africa and Middle East':'Africa and Middle East - All countries;Botswana;Democratic Republic of Congo;Egypt;Ghana;Guinea;Iran;Israel;Jordan;Kenya;Madagascar;Malawi;Mauritius;Morocco;Mozambique;Namibia;Nigeria;Oman;Reunion;Senegal;South Africa;Sudan;Swaziland;Syria;Tanzania;United Arab Emirates;Zambia;Zimbabwe',
 'Australia/NZ'          :'Australia/NZ - All countries;Australia;New Zealand',
 'East Asia'             :'East Asia - All countries;Japan;Mongolia;North Korea;South Korea;Taiwan, China;Hong Kong, China;China;;;China - Anhui;China - Chongqing;China - Fujian;China - Gansu;China - Guangdong;China - Guangxi;China - Guizhou;China - Hainan;China - Hebei;China - Heilongjiang;China - Henan;China - Hubei;China - Hunan;China - Inner Mongolia;China - Jiangsu;China - Jiangxi;China - Jilin;China - Liaoning;China - Ningxia;China - Qinghai;China - Shaanxi;China - Shandong;China - Shanghai;China - Shanxi;China - Sichuan;China - Tianjin;China - Xinjiang;China - Yunnan;China - Zhejiang',
 'Eurasia'               :'Eurasia - All countries;Belarus;Georgia;Kazakhstan;Kyrgyzstan;Russia;Tajikistan;Uzbekistan',
 'EU28'                  :'EU28 - All countries;Austria;Belgium;Bulgaria;Croatia;Czech Republic;Denmark;Finland;France;Germany;Greece;Hungary;Ireland;Italy;Latvia;Netherlands;Poland;Portugal;Romania;Slovakia;Slovenia;Spain;Sweden;United Kingdom',
 'non-EU Europe'         :'non-EU Europe - All countries;Balkans - All countries;Albania;Bosnia & Herzegovina;FYROM;Kosovo;Moldova;Montenegro;Serbia;Turkey;Ukraine',
 'Latin America'         :'Latin America - All countries;Argentina;Brazil;Chile;Colombia;Dominican Republic;El Salvador;Guatemala;Jamaica;Mexico;Panama;Peru;Venezuela',
 'Canada/US'             :'Canada/US - All countries;Canada;United States',
 'South Asia'            :'South Asia - All countries;Bangladesh;India;Pakistan;Sri Lanka',
 'SE Asia'               :'SE Asia - All countries;Cambodia;Indonesia;Laos;Malaysia;Myanmar;Philippines;Thailand;Vietnam',
}

// Two special cases: client wants the ability to select Balkans, even though not coded as region in the data
// partner wants ability to show a map of "Africa" via URL params (?region=Africa), but this shouldn't show as a map choice in the intro map select
var BALKANS = ['Moldova', 'Kosovo', 'Croatia', 'Romania', 'Serbia', 'Albania', 'Bulgaria', 'Greece', 'Montenegro', 'Slovenia', 'Bosnia & Herzegovina', 'FYROM'];
var AFRICA  = ['Botswana','Democratic Republic of Congo','Egypt','Ghana','Guinea','Kenya','Madagascar','Malawi','Mauritius','Morocco','Mozambique','Namibia','Nigeria','Reunion','Senegal','South Africa','Sudan','Swaziland','Tanzania','Zambia','Zimbabwe']

// the Universe of status types: these are the categories used to symbolize coal plants on the map
//          key: this matches the status name in the trackers table and the trackers.json
//          id: integer id, used by PruneCluster
//          text: this is how we display status in the legend
//          colorClass: used to construct divIcons since these do not take style arguments but only css classes for styling
// To add a new color, add a new css class or alter an existing one, and make sure the color definition is reflected here
// The STATUS_TYPE definitions are used everywhere colors or names are assigned on the front-end, so changes here should change everywhere (except 'About')
// The names in the database are assumed to be canonical; these names match the data. So if the client adds a new category, be sure to convert it to lower case on import, and add to the list here 
// to change which statuses display on the map at first, change the 'visible' flag
// NOTE: Keep in order by ID, otherwise the clusters "pie charts" will not get the correct color
var STATUS_TYPES = {
    'announced': {'id': 0, 'text': 'Announced', 'color': '#f3ff00', 'colorClass': 'yellow', 'visible': true},
    'pre-permit': {'id': 1, 'text': 'Pre-permit', 'color': '#ffa500', 'colorClass': 'orange', 'visible': true},
    'permitted': {'id': 2, 'text': 'Permitted', 'color': '#F26C4F', 'colorClass': 'pink', 'visible': true},
    'construction': {'id': 3, 'text': 'Construction', 'color': '#ff0000', 'colorClass': 'red', 'visible': true},
    'shelved': {'id': 4, 'text': 'Shelved', 'color': '#5974a2', 'colorClass': 'blue', 'visible': true},
    'retired': {'id': 5, 'text': 'Retired', 'color': '#58a1a1', 'colorClass': 'lightblue', 'visible': true},
    'cancelled': {'id': 6, 'text': 'Cancelled', 'color': '#4CDB4C', 'colorClass': 'green', 'visible': true},
    'operating': {'id': 7, 'text': 'Operating', 'color': '#845440', 'colorClass': 'brown', 'visible': true},
    'mothballed': {'id': 8, 'text': 'Mothballed', 'color': '#d6a490', 'colorClass': 'lightbrown', 'visible': true},
};

// used to keep a list of markers showing for a particular country or place, by status
// allows us to 'filter' markers, e.g. show/hide using FilterMarkers method added to leaflet.prunecluster.js
// ** IMPORTANT: ensure that these keys match the keys in STATUS_TYPES exactly
// NOTE: Keep in order by ID, otherwise the clusters "pie charts" will not get the correct color
var STATUS_MARKERS = {
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

// TO DO: prunecluster.markercluster.js needs this, but must be a better way?
window.markercluster_colors = $.map(STATUS_TYPES, function(val, i) { return val.color });

// object to hold the datatable upon initialization. See initTable() and also resizeTable
var OTABLE;

// keep track of the current nav tab id; defaults to map-tab at startup
// TO DO: can we get this from data attributes, instead of a global?
var CURRENT_TAB = 'map-tab';

// variable to show if we are are mobile or ipad client
var ISMOBILE = ($.browser.mobile || ipad);
// keep track of the currently masked countries, used so that we don't highlight hover current countries
var CURRENT_COUNTRIES; // only on desktop

// allowed url params
var OK_PARAMS = ['region','country'];


///////////////////////////////////////////////////////////////////////////////////
///// INIT: this function is called when the page is ready,
///// and calls a series of known-to-exist functions such as initMap() and initQueryPanel()
///// lastly it will call initThisCountry() which each country's JS file is free to define
///////////////////////////////////////////////////////////////////////////////////

$(document).ready(function () {
    initStartupModal();     // init the modal dialog that kicks things off
    initNavBar();           // init the main navigation tabs
    initFreeSearch();       // init the "free" search inputs
    initTable();            // the Table is fully populated from the trackers dataset, but is filtered at runtime
    initLeafletExtras();    // an extra Leaflet extension or two
    initMap();              // regular leaflet map setup
    initPruneCluster();     // set up the PruneClusters for clustering coal plant markers
    initMapLayerControl();  // initialize the layer and basemap pickers
    initZoom();             // init the zoom button on the popup dialogs
    initState();            // init app state given url options

    // ready!
    setTimeout(function () {
        $('#pleasewait').hide();
        $(window).trigger('resize');
        // performSearch('everything');
    }, 1000);
});

// listen for changes to the window size and resize the map
$(window).resize(function() {
    resizeMap();        // function to resize the map
    resizeTable();      // function to resize the table
    resizeAbout();      // resize about content
    updateSearchBar();  // update visibility of searchbar
})

function updateSearchBar() {
    var placeholder = 'Type a project name, company, country...';
    var search = $('input#mapsearch, input#tablesearch');
    var width = $(window).width();
    if (width < 768) {
        console.log(width);
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

// resize the map based on window height minus tab height (including margins)
function resizeMap() {
    // 42px for the nav bar, 10px top and bottom #map, 10px top of #container = 42 + 20 + 10
    var newSize = $(window).height() - 72;
    if (newSize > 1000) newSize = 1000;
    $('#map').height(newSize);

    MAP.invalidateSize();
    // resize the sidebar to match the new map height
    $('#sidebar-map').height($('#map').height());
}

// tab content seems to inherit "position:fixed" from .tab-pane, so cannot get dynamic scrolling content
// instead we set about-content to fixed size based on window height, and add overflow:auto in css
function resizeAbout() {
    // 42px for the nav bar, 10px top and bottom margin, 10px top of #container = 42 + 20 + 10
    var newSize = $(window).height() - 72;
    if (newSize > 1000) newSize = 1000;
    $('#about-content').height(newSize);
}

// attempt to resize all DataTables for different window heights. 
// see also getTablecutoff() which defines variabele heights (as percentages) to apply based on different window heights
function resizeTable() {
    // guesstimate a good scrollbody height; dynamic based on the window height
    // varies with different tables; not sure why and spent too much time already trying to understand
    var tablediv = $('.dataTables_scrollBody');
    if (!tablediv.length) return; // the case where you don't select something before exploring the app
    var value = CURRENT_TAB == 'summary-tab' ? 250 : 280;
    // differential sizing depending on if there is a horizontal scrollbar or not
    if (tablediv.hasHorizontalScrollBar()) value += 10;

    var scrollbodyHeight = $('body').height() - value;

    // set the scrollbody height via css property
    tablediv.css('height', scrollbodyHeight);
}

///////////////////////////////////////////////////////////////////////////////////
// Functions called on doc ready
///////////////////////////////////////////////////////////////////////////////////

// open the modal dialog(s) that launch on startup. The idea here is to guide the user to a map or table according to their choice
// startup modal is opened in initState();
function initStartupModal() {
    // listen for clicks on the "back" links; get modal to return to from data-return attribute
    $('.back-link').click(function() {
        var modal_return = $(this).data().back;
        $('#' + modal_return).modal();
    })

    // listen for clicks on the "about" links and open about on click
    $('.about-link').click(function() {
        $('#about-tab').tab('show');
    })
}

// allowing url params, with the following characteristics
// 1. this is not a free search, e.g. can't do ?place='Oakland, CA', 
// 2. instead this must fit our country, region or subnational definitions. see REGION_COUNTRIES
// 3. url form must conform to ?type=place, where type is one of [region, country], and place is in REGION_COUNTRIES
// 4. places are defined in REGION_COUNTRIES to be readable through a dialog form, so here we do some checking to put them back in proper case
function initState() {
    // first check if we are loading from url params or not
    var params = window.location.href;
    // if we have url params, get the params and use them to set state
    var queryposition = params.indexOf('?');
    var modal = true;
    if (queryposition > -1) {
        modal = setStateFromParams();
    }

    // no params, carry on as usual
    // fit the map to bounds
    if (modal) {
        MAP.fitBounds(MAPBOUNDS);
        // open the startup modal
        $('#map-modal').modal();
    }
}

function setStateFromParams() {
    // get the params
    var rawparams = $.url(params);
    var params = rawparams.data.param.query;
    var type = Object.keys(params)[0];
    var place = params[type];
    // error checking 1: check for legal type
    if (OK_PARAMS.indexOf(type) == -1) return true;
    // error checking 2: many country errors are built in, e.g. ?country=France alerts "No coal plants found"
    // but we will attempt to put in proper case to match REGION_COUNTRIES
    var place = place.toTitleCase();
    // error checking 3: check for a match to known region in REGION_COUNTRIES
    if (type == 'region') {
        var regions = Object.keys(REGION_COUNTRIES);
        // weird special case: Add Africa
        regions.push('Africa');
        if (regions.indexOf(place) == -1) return true; // didn't match a known region
    };
    // all is well, do the search
    dispatchSearch(type, place); 
    return false;
}

// initialize the map in the main navigation map tab
function initMap() {
    // basic leaflet map setup
    MAP = L.map('map', {
        attributionControl:false,
        minZoom: MINZOOM, maxZoom: MAXZOOM,
        attribution: "Interactive mapping by GreenInfo Network. Data: CoalSwarm"
    });

    // add attribution
    var credits = L.control.attribution().addTo(MAP);
    credits.addAttribution('Interactive mapping by <a href="http://greeninfo.org" target="_blank">GreenInfo Network</a>. Data: <a href="http://coalswarm.org/" target="_blank">CoalSwarm</a>, © <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>');

    // the custom L.control back button, used when zooming to a coal plant
    BACK_BUTTON = new L.backButton() // not added now, see initZoom()

    // Globals defined as L.layerGroup() to hold various map objects
    // to hold the mask, essentially a grey box covering the world minus the country in the view
    MASK = L.featureGroup([], { zIndex: 14 }).addTo(MAP);

    // Desktop only: to hold countries hover/click, adding as an empty layer group to the map for now, populated after data get, below
    if (!ISMOBILE) COUNTRIES = L.featureGroup([], { zIndex: 25 }).addTo(MAP);
    $.get('./data/countries.json', {}, function (data) {
        DATA_COUNTRIES = data; // need country data for mobile and desktop, see performSearch();
        // initialize hover and click on countries
        // desktop only as this seems to degrade performance on mobile/ipad
        if (!ISMOBILE) { L.geoJson(data,{ style: INVISIBLE_STYLE, onEachFeature: massageCountryFeaturesAsTheyLoad }).addTo(COUNTRIES) }
    }, 'json');

    // populate the map legend entries to match STATUS_TYPES values and colors.
    // this way, we only have to config in one place when things change (here in the javascript for STATUS_TYPES = {})
    // note, this same strucure also populates the fields in the popups, see
    var target = $('#legend-labels').html(''); // clear existing html
    $.each(STATUS_TYPES, function(key, value){
        var label = $('<label>');
        var input = $('<input>', {
            type: 'checkbox',
            value: key
        })
        // which statuses to display by default? 
        var check = STATUS_TYPES[key].visible;
        input.attr('data-check-after-search', check);
        input.appendTo(label);

        var outerSpan = $('<span>').appendTo(label);
        // adds colored circle to legend
        var div = $('<div>', {
            style: "background:" + STATUS_TYPES[key].color,
            "class": "circle"
        }).appendTo(outerSpan);
        // adds text to legend
        var innerSpan = $('<span>', {
            text: ' ' + STATUS_TYPES[key].text
        }).appendTo(outerSpan)

        label.appendTo(target);
    })

    // legend init for mobile: hide on load
    var layercontrol = $('.layer-control');
    if (ISMOBILE) layercontrol.hide();

    // init the layer icon control to open the legend
    $('#layers-icon').on('click', function(){ layercontrol.show() })    
    
    // listen for map clicks, on mobile, close the legend
    MAP.on('click', function(){
        if (!ISMOBILE) return;
        if (layercontrol.is(':visible')) layercontrol.hide();  
    });

    // finally: uber-hack to get the map to display in the bootstrap tab
    $('#table-tab').tab('show');
    $('#map-tab').tab('show');
    resizeMap();
    MAP.invalidateSize();
}

function initMapLayerControl() {
    // turn on the default basemap (streets aka basemap)
    BASEMAPS['basemap'].addTo(MAP);
    CURRENT_BASEMAP = 'basemap';

    // set listener on radio button change to change to the selected basemap
    // and also control whether or not the mask is showing
    $('#layers-base input').change(function() {
        var selected = $(this).data().baselayer;
        // remove current basemap
        MAP.removeLayer(BASEMAPS[CURRENT_BASEMAP]);
        // add selected basemap
        MAP.addLayer(BASEMAPS[selected]);
        // and keep track of what was added
        CURRENT_BASEMAP = selected;

        // when *any* satellite basemap added, turn off mask
        if (selected === 'hybrid' || selected === 'satellite') {
            MAP.removeLayer(MASK);
        } else {
        // turn on mask
            MAP.addLayer(MASK);
        }
    });

    // set listener on tracker status checkboxes to show or hide by status, and update the clusters
    $('#layers-trackers input').change(function() {
        var status = $(this).val();
        var markers = STATUS_MARKERS[status].markers;
        CLUSTERS.FilterMarkers(markers, !$(this).prop('checked')); // false to filter on, true to filter off :)
        CLUSTERS.ProcessView();
    })

}

// some basics for initializing the PruneClusters, and overriding some factory methods
function initPruneCluster() {
    // create a new PruceCluster object, with a minimal cluster size of (30)
    // updated arg to 30; seems to really help countries like China/India
    CLUSTERS = new PruneClusterForLeaflet(30); 
    MAP.addLayer(CLUSTERS);

    // this is from the categories example; sets ups cluster stats used to derive category colors in the clusters
    CLUSTERS.BuildLeafletClusterIcon = function(cluster) {
        var e = new L.Icon.MarkerCluster();

        e.stats = cluster.stats;
        e.population = cluster.population;
        return e;
    };

    // don't force zoom to a cluster on click (the default): this is annoying
    CLUSTERS.BuildLeafletCluster = function (cluster, position) {
        var _this = this;
        var m = new L.Marker(position, {
            icon: this.BuildLeafletClusterIcon(cluster)
        });
        // this defines what happen when you click a cluster, not the underlying icons
        m.on('click', function () {
            var markersArea = _this.Cluster.FindMarkersInArea(cluster.bounds);
            var b = _this.Cluster.ComputeBounds(markersArea);

            if (b) {
                // skip the force zoom that is here by default, and just show the overlapping icons
                _this._map.fire('overlappingmarkers', { markers: markersArea, center: m.getLatLng(), marker: m });
            }
        });
        return m;
    }

    // handle clicks on individual plant markers (not the clusters)
    CLUSTERS.PrepareLeafletMarker = function(leafletMarker, data){
        var html = data.title + "<br>" + "<div class='popup-click-msg'>Click for details</div>";
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
        leafletMarker.on('mouseout', function() { MAP.closePopup(); });
    }
}

// initialize the main navigation tabs, map, table, about (etc. if others)
function initNavBar() {
    // listens for click on any of the main nav tabs and shows the requested tab
    $('#index-tabs a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
    })

    // adds a listener to the map tab to resize the map when clicked
    $('#map-tab').on('shown.bs.tab', function (e) {
        MAP.invalidateSize(false);

        // set current_tab to the current tab id
        CURRENT_TAB = 'map-tab';

        // show the correct search form
        $('#nav-place-search').show();
        $('#nav-table-search').hide();
    });

    // listens to request to show the table tab and resizes columns so they look aligned (known issue when using scroll-Y in datatables)
    // this is also called on table initialization, but not working there
    $('#table-tab').on('shown.bs.tab', function (e) {
        if (OTABLE) {
            OTABLE.draw();
            resizeTable();
        }
        // set current_tab to the current tab id
        CURRENT_TAB = 'table-tab';

        // show the search form
        $('#nav-table-search').show();
        $('#nav-place-search').hide();
    });

    // listener on the about tab
    $('#about-tab').on('shown.bs.tab', function (e) {
        // set current_tab to the current tab id
        CURRENT_TAB = 'about-tab';
        resizeAbout();

        // hide the search forms
        $('#nav-table-search').hide();
        $('#nav-place-search').hide();
    });

    // show the sidebar by clicking the search icon on nav-tab bar
    $('#nav-panel-search-icon').click(function() {
        // clicking buttons in nav-tabs changes their style
        // so we remove the active class, and pass it back to whatever was active before
        $(this).parent().removeClass('active');
        fixTabStyle(CURRENT_TAB);

        // remove any text from the input
        $('#panel-place-search input').val('');
    });
}

// itialization functions for the table. Table data is populated only after a search is performed
function initTable() {
    // init the table search form. This mimics the built-in datatables 'filter', but includes the already selected area
    // this way, we only ever search within a given selection (either all records, or a subset)
    // if we are looking at the default table, do not filter, start from all records. Otherwise, use the selection term
    $('#nav-table-search input, #panel-table-search input').keyup(function() {
        // search the table with the typed value, and refresh
        OTABLE.search( this.value ).draw();
    });

    // the table will not in fact be populated here, but when a search is performed
    // see performSearch() and the dispatchers for it, where the resulting trackers will be loaded into the table

    // to filter programmatically: oTable.fnFilter("United")
    // to get selected/filtered rows: var rows = OTABLE.rows({"filter":"applied"}).data();
}

function initFreeSearch() {
    // This inits the "free search" forms; essentially an input that allows any valid address/place, then gets that place's country to display the countries coal plants
    // triggered in two places: input on the map and table
    $('.free-search').submit(function(event) {
        // prevent default browser behaviour
        event.preventDefault();

        // get the location from the input
        var type = $(this).data().type;
        var location = $('.free-search input[data-type="' + type + '"]').val();
        // Now get the country and draw the coal plants on the map
        // get the promise object, use it below
        deferredResponse = _geocoder(location).done(function(response) {
            if(typeof response.resourceSets[0].resources[0] == 'undefined') return raiseLocationError();

            // clear the search text boxes; not sure why they want this but they do
            $('#nav-place-search input, #nav-table-search input').val('').blur();

            // too bad the search is async now: we can't intercept a country having no coal plants
            var country = response.resourceSets[0].resources[0].address.countryRegion;

            // this country is what Bing returns, which doesn't always match the country name in Tracker data
            // so trap some of these exceptions here, and return the country name that matches the Trackers
            // This is quite a rabbit hole - there are undoubtedly more than listed here
            // AND these change over time (e.g. Swaziland is no longer the official country name, but at the time of writing, still works)
            switch (country) { 
                case 'FYRO Macedonia':
                    country = 'FYRO';
                    break;
                case "Côte d'Ivoire":
                    country = 'Ivory Coast';
                    break;
                case 'Hong Kong SAR':
                    country = 'Hong Kong, China';
                    break;
                case 'Niger':
                    country = 'The Niger';
                    break;
                // can't actually trap this until below in performSearch
                default:
                    country = country;
            }

            performSearch('country',country);
        });
    });

    $('#nav-place-search button').click(function () {
        $(this).closest('form').submit();
    });
}

// detect region, country, or subnat and hand off to common handler, it will fetch and filter the data itself
function dispatchSearch(type, place) {
    if (type == 'region') {
        // it's a region!
        var region = place.split(' - ')[0];
        performSearch('region',region);
    } else if (place.indexOf(" - ") > -1) {
        // it's a subnation!
        var places = place.split(" - ");
        place   = places[1];
        country = places[0];
        performSearch('subnat',place,country);
    } else {
        // it's a country!
        performSearch('country',place);
    }
}

function initLeafletExtras() {
    // a leaflet control to take the user back from where they came
    // Only visible when zooming to an individual plant from the dialog popup. Hidden otherwise.
    L.backButton = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function (map) {
            var container   = L.DomUtil.create('div', 'btn btn-primary btn-back', container);
            container.title = 'Click to go back to the previous view';
            this._map       = map;

            // generate the button
            var button = L.DomUtil.create('a', 'active', container);
            button.control         = this;
            button.href            = 'javascript:void(0);';
            button.innerHTML       = '<span class="glyphicon glyphicon-chevron-left"></span> Go back to country view';

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
            MAP.fitBounds(MAPBOUNDS);

            // remove current basemap
            MAP.removeLayer(BASEMAPS[CURRENT_BASEMAP]);
            // add the plain basemap - we could try to keep track of which basemap the user
            // was on before zooming in - but what if they zoom in to another? then the current
            // basemap becomes satellite - and tracking all this gets ridiculous
            MAP.addLayer(BASEMAPS['basemap']); CURRENT_BASEMAP = 'basemap';

            // keep the radio button in sync with the map
            $('#layers-base input[data-baselayer="' + CURRENT_BASEMAP + '"]').prop("checked", true);
            // remove the mask if its showing
            if (CURRENT_BASEMAP == 'basemap') MAP.addLayer(MASK);

            // remove the back button
            BACK_BUTTON.removeFrom(MAP);

            // finally bring the trackers forward (not sure exactly why, but all this basemap switching)
            // TRACKERS.bringToFront();
            COUNTRIES.bringToFront();

        }
    });
}

// listen for clicks on the "Zoom In" button on the modal popups for a plant.
// Zoom the map to the selected plant and change the basemap to google satellite
function initZoom() {
    $('#btn-zoom').click(function(){
        // ok, so we're not zoomed in, continue
        var target = $(this).data().zoom.split(",");
        var lat = target[0];
        var lng = target[1];
        var latlng = L.latLng([lat, lng]);
        var zoom = 16;

        // remove current basemap
        MAP.removeLayer(BASEMAPS[CURRENT_BASEMAP]);
        // add google satellite basemap: this has the most detail
        MAP.addLayer(BASEMAPS['satellite']);
        CURRENT_BASEMAP = 'satellite';
        // keep the radio button in sync with the map
        $('#layers-base input[data-baselayer="satellite"]').prop("checked", true);
        // remove the mask if its showing
        MAP.removeLayer(MASK);

        // add the back button, which takes the user back to previous view (see function goBack() defined in the construction of Leaflet control)
        // but only if there is not already a back button on the map
        if ($('.btn-back').length == 0) BACK_BUTTON.addTo(MAP);

        // move and zoom the map to the selected unit
        MAP.setView(latlng, zoom);

    });
}

///////////////////////////////////////////////////////////////////////////////////
// General functions
///////////////////////////////////////////////////////////////////////////////////

function populateMapWithTrackers(trackers) {
    CLUSTERS.RemoveMarkers();

    $.each(trackers, function (i, feature) {
        // the "status" of the tracker point affects its icon decision
        // and also its membership in STATUS_MARKERS for per-status filtering
        var status = feature.properties.status;
        var statusId    = STATUS_TYPES[status]['id'];
        var statusColor = STATUS_TYPES[status].colorClass;
        var marker = new PruneCluster.Marker(feature.geometry.coordinates[1], feature.geometry.coordinates[0], {
            // this should work but sadly seems that prunecluster does not pick it up
            title: feature.properties.unit,
            icon: L.divIcon({
                    className: 'circle-div ' + statusColor, // Specify a class name we can refer to in CSS.
                    iconSize: [15, 15] // Set the markers width and height
                })
        });

        // get the attributes for use in the custom popup dialog (see openTrackerInfoPanel())
        marker.data.attributes = feature.properties;

        // get the lat-lng now so we can zoom to the plant's location later
        // getting the lat-lng of the spider won't work, since it gets spidered out to some other place
        // tip: the raw dataset is lng,lat and Leaflet is lat,lng
        marker.data.coordinates = [ feature.geometry.coordinates[1], feature.geometry.coordinates[0] ];

        // set the category for PruneCluster-ing
        marker.category = statusId;

        // furthermore, if the marker shouldn't be visible at first, filter the marker by setting the filtered flag to true (=don't draw me)
        if (!STATUS_TYPES[status].visible) marker.filtered = true;

        // register the marker for PruneCluster clustering
        CLUSTERS.RegisterMarker(marker);

        // also add the marker to the list by status, so we can toggle it on/off in the legend
        // see MAP.on('overlayadd') and MAP.on('overlayremove')
        STATUS_MARKERS[status].markers.push(marker);
    });

    CLUSTERS.ProcessView();
}

function showPopup(e) {
    console.log(e);
}

function populateTableWithTrackers(trackers, name) {
    // set up the table columns: this is the subset of table column names we want to use in the table
    var tableColumns = $.map(COLUMN_NAMES, function(value){ return value; });
    // set up table names. These are the formatted column names for the table
    var tableNames = Object.keys(COLUMN_NAMES);
    // don't include column for wiki-page; we're going to save this as a link in the unit name
    var index = $.inArray('wiki_page',tableColumns);
    tableColumns.splice(index, 1);
    tableNames.splice(index, 1);
    // also, drop unit from the list of tableColumns; we'll get this directly below and turn it into a url
    var index2 = $.inArray('unit', tableColumns);
    tableColumns.splice(index2, 1);
    // put table names into format we need for DataTables
    var aoColumns = [];
    $.each(tableNames, function(k, value) {
        // set up an empty object and push a sTitle keys to it for each column title
        var obj = {};
        obj['sTitle'] = value;
        aoColumns.push(obj);
    });

    // set up the table data
    var data = [];
    $.each(trackers, function() {
        var tracker = this;
        if (! tracker.properties.unit) return; // no unit, bad data, bail

        // get the properties for each feature
        var props = tracker.properties;

        // make up a row entry for the table: a list of column values
        // now, manipulate unit so that unit name is a url to the wiki page
        // the other columns we can just copy over as is to this row
        var row = [];
        row.push('<a href="' + tracker.properties.wiki_page + '" target="_blank">' + tracker.properties.unit + '</a>');
        $.each(tableColumns, function(i,val) { row.push(props[val]); })

        // when that's all done, push the row as another [] to data
        data.push(row);
    });

    // the following are needed to initialize the table as a responsive "datatable"
    // following defines default breakpoints
    var responsiveHelper;
    var breakpointDefinition = {
        tablet: 1024,
        phone : 480
    };

    // get the table target from the dom
    var tableElement = $('#table-content table');
    // purge and reinitialize the DataTable instance
    // NOTE with 1.10 initialization can be called with table.DataTable({}) as opposed to table.dataTable({})
    // this opens up many new methods, but certain old ones no longer work :L
    // first time initialization
    if (!OTABLE) {
        OTABLE = tableElement.DataTable({
            "aaData"         : data,
            "deferRender"    : true,
            "aoColumns"      : aoColumns,
            "autoWidth"      : true,
            "scrollY"        : "1px", // initial value only, will be resized by calling resizeTable;
            "lengthMenu"     : [10, 50, 100, 200, 500],
            "iDisplayLength" : 50, // 100 has a noticable lag to it when displaying and filtering; 10 is fastest
            // responsive callbacks. See https://github.com/Comanche/datatables-responsive
            preDrawCallback: function () {
                // Initialize the responsive datatables helper once.
                if (!responsiveHelper) {
                    responsiveHelper = new ResponsiveDatatablesHelper(tableElement, breakpointDefinition);
                }
            },
            rowCallback: function (nRow) {
                responsiveHelper.createExpandIcon(nRow);
            },
            drawCallback: function (oSettings) {
                responsiveHelper.respond();
            }
        });
    // every subsequent search: we don't need to reinitialize, just clear and update rows
    } else {
        OTABLE.clear();
        OTABLE.rows.add(data);
        OTABLE.draw();
    }

    // finally, set the table title
    $('#table h2 span').text(RECORDS_TEXT + name);
}

function fixTabStyle(currentTab) {
    // called after clicking the nav-tab "icons" - clicking buttons in nav-tabs changes their style
    // add active class to the currently active tab so it shows border
    $('#' + CURRENT_TAB).parent().addClass('active');
}


// geocode with Bing. private function meant to be called by parent function. Returns promise object
function _geocoder(address) {
    // first some basic address clean-ups
    // is this an L.Latlng? Or simple text?
    if (address instanceof L.LatLng) {
        address = address.lat + "," + address.lng;
    } else {
        address = address.replace(/^\s+/,'').replace(/\s+$/,'').toLowerCase();
        address = address.replace('&', 'and');
    }

    // form the urs and params
    var url    = 'https://dev.virtualearth.net/REST/v1/Locations/' + encodeURIComponent(address);
    var params = { output:'json', key:BING_API_KEY };

    // make the request
    return $.ajax(url, {
        dataType: 'jsonp',
        jsonp: 'jsonp',
        crossDomain: true,
        data: params,
    })
}

function zoomToBox(bing_bbox) {
    // zoom to a bbox from bing geocoder
    var bbox = bing_bbox,
        first = new L.LatLng(bbox[0], bbox[1]),
        second = new L.LatLng(bbox[2], bbox[3]),
        bounds = new L.LatLngBounds([first, second]);
    MAP.fitBounds(bounds);
    MAPBOUNDS = bounds; // keep for later
}

// an error fn used by the country geocoder
function raiseLocationError() {
    return alert('Could not find your address or location. Please try again');
}

// when user clicks on a coal plant point, customize a popup dialog and open it
function openTrackerInfoPanel(pointFeature) {
    // get the features properties, i.e. the data to show on the modal
    var properties = pointFeature.attributes;
    // get the popup object itself and customize
    var popup = $('#tracker-modal');
    // go through each property for this one feature, and write out the value to the correct span, according to data-name property
    $.each(properties, function(dataname, value) {
        // get preferred text for each status types
        if (dataname == 'status') value = STATUS_TYPES[value].text;
        // write the status name to the dialog
        $('#tracker-modal .modal-content span').filter('[data-name="' + dataname + '"]').text(value);
    })

    // wiki page needs special handling to format as <a> link
    var wiki_html = properties['wiki_page'];
    var wiki = $('#tracker-modal .modal-content span').filter('[data-name="wiki_page"]').text('');
    $('<a>', { text: wiki_html, href: wiki_html, target: "_blank"} ).appendTo(wiki);

    // format the zoom-to button data.zoom attribute. See initZoom();
    // this lets one zoom to the location of the clicked plant
    var zoomButton = $('#btn-zoom');
    var point = pointFeature.coordinates;
    zoomButton.data().zoom = point[0] + "," + point[1];

    // last step: open the dialog
    popup.modal();
}

// resets the app to default state in terms of map view and modal menu; does not download any data or files
function resetTheMap() {
    // switch to the map tab
    $('#map-tab').tab('show');

    // clear existing mask and trackers clusters
    CLUSTERS.RemoveMarkers();
    MASK.clearLayers();

    // switch the basemap to the plain old basemap
    // remove current basemap
    MAP.removeLayer(BASEMAPS[CURRENT_BASEMAP]);
    // add the default streets layer
    MAP.addLayer(BASEMAPS['basemap']);
    CURRENT_BASEMAP = 'basemap';
    // set the default view
    MAP.fitBounds(HOMEBOUNDS);

    // finally, resize and invalidate the map for good measure
    resizeMap(); MAP.invalidateSize();
}

// this callback is used when COUNTRIES is loaded via GeoJSON; see initMap() for details
function massageCountryFeaturesAsTheyLoad(rawdata,feature) {
    // on mouseover, highlight me; on mouseout quit highlighting
    // on click, search and zoom to the selected country
    feature.on('mouseover', function (e) {
        // don't highlight me if I'm in the list of current focal countries
        if ($.inArray(this.feature.properties['NAME'].toLowerCase(), CURRENT_COUNTRIES) < 0) this.setStyle(HIGHLIGHT_STYLE);
    }).on('mouseout', function (e) {
        this.setStyle(INVISIBLE_STYLE);
    }).on('click', function (e) {
        // only move to new country if clicking outside current country
        // TODO: This is how it was on the old app
        // here, though we need to be able to click on a country, because the default starting view is all countries
        // if ($.inArray(this.feature.properties['NAME'].toLowerCase(), CURRENT_COUNTRIES) < 0) {
            // call the display country function
            performSearch('country', this.feature.properties['NAME']);
            // and remove the highlighted feature (that we just hovered to reveal)
            this.setStyle(INVISIBLE_STYLE);
        // }
        // hack to unspider the currently open spider
        SPIDER.Unspiderfy();
    });
}

// the search systemws: 3 similar but distinct types of searching
// - superficially similar, they do filter against different attributes and that's why there're 3 handlers
// - the basic need to dump-and-reload the JSON dataset is in common, so that forms THE entry point
// - it then hands off the fetched tracker dataset and country dataset to the search dispatcher,
//      which will filter the data down and effect a search upon it
//      then do things like the country mask, the table filtering, and re-populating the clusterer
function performSearch(type,name,extra) {
    // if we've already zoomed in to a unit, remove the back button
    if ($('.btn-back').length > 0) {
        // forcing the basemap to basemap; a bit of a hard option
        // but other options worse (tracking what basemap we started from, etc.)
        MAP.removeLayer(BASEMAPS[CURRENT_BASEMAP]);
        MAP.addLayer(BASEMAPS['basemap']); CURRENT_BASEMAP = 'basemap';
        $('#layers-base input[data-baselayer="' + CURRENT_BASEMAP + '"]').prop("checked", true);
        MAP.addLayer(MASK);
        BACK_BUTTON.removeFrom(MAP);
    }

    // a promise-like system so we don't have deep pyramids; awesome
    // load the tracker GeoJSON and the country TopoJSON, then filter to only the area of interest
    // prior version would load all points and all countries, but this was laggy on good hardware and crashy on poor/mobile hardware
    // note that, while this appears to load the json every search, in fact this should be (will be?) cached
    var data_trackers;
    var requests = [];
    requests.push($.get('./data/trackers.json', {}, function (data) {
        data_trackers = data;
    }, 'json'));

    $('#pleasewait').show();
    $.when.apply($, requests).done(function(){
        // got both datasets loaded AND pruned to have only the items of relevance
        // and loaded into those globals
        // hand off to the dispatcher for our search area type
        $('#pleasewait').hide();
        switch (type) {
            case 'region':
                searchRegion(name,DATA_COUNTRIES,data_trackers);
                break;
            case 'country':
                searchCountry(name,DATA_COUNTRIES,data_trackers);
                break;
            case 'subnat':
                searchSubnational(name,extra,DATA_COUNTRIES,data_trackers);
                break;
            case 'everything':
                searchEverything(DATA_COUNTRIES, data_trackers);
        }
    });

}

// show all trackers on the map at once
function searchEverything(data_countries, data_trackers) {
    // step 1: filter through the countries and find the total polygon by combining the geometry for all these countries in the region
    // - massage it to always be a multipolygon so we're consistent, but that's OK since we're ALWAYS ending up with >1 polygon so no massaging is needed
    // - some countries cross the date line and need a special bounding box
    // - the coordinates are backward
    // - some countries (okay, one) wrap the dateline and need their coords modified if lng > 180
    // while we're at it, keep a list of what countries matched, for later use in step 6
    var polygon = [], polygontype, countries = {};
    for (var i=0, l=data_countries.features.length; i<l; i++) {
        var country = data_countries.features[i].properties.NAME;
        // is this country a match?
        // here everything is a match
        // log the matched country in countries{}
        countries[country] = true;
        // may be polygon or multipolygon; standardize into a multi-ring
        var outmulti = []; // to hold a copy of our geometry (not a reference)
        var thismulti = data_countries.features[i].geometry.coordinates;
        var thistype  = data_countries.features[i].geometry.type;
        if (thistype == 'Polygon') thismulti = [ thismulti ];

        for (var pi=0, pl=thismulti.length; pi<pl; pi++) {
            outmulti.push([]);
            for (var ri=0, rl=thismulti[pi].length; ri<rl; ri++) {
                outmulti[pi].push([]);
                for (var vi=0, vl=thismulti[pi][ri].length; vi<vl; vi++) {
                    switch (country) {
                        case 'Russia':
                            if ( thismulti[pi][ri][vi][0] < -0) thismulti[pi][ri][vi][0] += 360;
                            break;
                    }
                    // slice to get a copy, otherwise we save a reference, and flip coordinates on the original data!
                    outmulti[pi][ri][vi] = [ thismulti[pi][ri][vi][1] , thismulti[pi][ri][vi][0]].slice();
                }
            }

            // done flipping coords for this polygon; add the polygon to multipolygon we're collecting
            // polygon = polygon.concat( outmulti[pi] );
            polygon = polygon.concat( outmulti[pi] );
        }
    }
    polygon = L.multiPolygon(polygon);
    // step 2: empty the highlights, and recalculate the mask, load it in as COUNTRIES
    var rings = [];
    $.each( polygon.getLatLngs() , function () { rings.push(this.slice(0)); });
    rings.unshift(OUTERRING);
    L.polygon(rings, MASKSTYLE).addTo( MASK.clearLayers() );

    // step 3: clear the CLUSTERS marker custering system and repopulate it with tracker points
    // as we go through, log what statuses are in fact seen; this is used in step 5 to show/hide checkboxes for toggling trackers by status
    // as we go through, keep a list of the trackers for the table in step 4
    var statuses   = {};
    var trackers   = [];
    $.each(data_trackers.features, function () {
        // this is not a true Leaflet feature, just an entry in a GeoJSON-copmpatible data structure; that's why it's performant
        var feature = this;

        var status = feature.properties.status;
        statuses[status] = true; // log that this status has been seen, see step 5 below

        // add the feature to the trackers list for the table
        trackers.push(feature);

    });
    var bounds = L.geoJson(data_trackers.features).getBounds();
    MAP.fitBounds(bounds); 
    MAPBOUNDS = bounds; // keep for later

    // step 4a and 4b: update the table and the marker clustering, now that "trackers" is implicitly filtered to everything that we need
    populateMapWithTrackers(trackers);
    populateTableWithTrackers(trackers, 'All Trackers');

    // step 5: hide the status toggle checkboxes, showing only the ones which in fact have a status represented
    showLegendCheckboxes(statuses);

    // step 6: update the list of highlighted countries, used by the highlight hover effect, for DESKTOP only
    if (!ISMOBILE) {
        CURRENT_COUNTRIES = [];
        for (var c in countries) CURRENT_COUNTRIES.push( c.toLowerCase() );
        COUNTRIES.bringToFront();
    }


}

function searchRegion(name, data_countries, data_trackers) {
    // step 1: filter through the countries and find the total polygon by combining the geometry for all these countries in the region
    // - massage it to always be a multipolygon so we're consistent, but that's OK since we're ALWAYS ending up with >1 polygon so no massaging is needed
    // - some countries cross the date line and need a special bounding box
    // - the coordinates are backward
    // - some countries (okay, one) wrap the dateline and need their coords modified if lng > 180
    // while we're at it, keep a list of what countries matched, for later use in step 6
    var polygon = [], polygontype, countries = {};
    for (var i=0, l=data_countries.features.length; i<l; i++) {
        // is this country a match?
        // big hack: client doesn't want exact country/region matches, but has exceptions
        //      non-EU Europe should catch both non-EU Europe and a list of Balkans countries
        //      Balkans matches country name in global list (this is not coded in "Region")

        var country = data_countries.features[i].properties.NAME;
        switch (name) {
            case 'non-EU Europe':
                if (data_countries.features[i].properties.REGION != 'non-EU Europe' && ( $.inArray( country, BALKANS) == -1) ) continue;
                break;
            case 'Balkans':
                if ( $.inArray( country, BALKANS) == -1) continue;
                break;
            case 'Africa': 
                if ( $.inArray( country, AFRICA) == -1) continue;
                break;
            default:
                if (data_countries.features[i].properties.REGION != name) continue;
                break;
        }

        // log the matched country in countries{}
        countries[country] = true;
        // may be polygon or multipolygon; standardize into a multi-ring
        var outmulti = []; // to hold a copy of our geometry (not a reference)
        var thismulti = data_countries.features[i].geometry.coordinates;
        var thistype  = data_countries.features[i].geometry.type;
        if (thistype == 'Polygon') {
            thismulti = [ thismulti ];
        }

        for (var pi=0, pl=thismulti.length; pi<pl; pi++) {
            outmulti.push([]);
            for (var ri=0, rl=thismulti[pi].length; ri<rl; ri++) {
                outmulti[pi].push([]);
                for (var vi=0, vl=thismulti[pi][ri].length; vi<vl; vi++) {
                    switch (country) {
                        case 'Russia':
                            if ( thismulti[pi][ri][vi][0] < -0) thismulti[pi][ri][vi][0] += 360;
                            break;
                    }
                    // slice to get a copy, otherwise we save a reference, and flip coordinates on the original data!
                    outmulti[pi][ri][vi] = [ thismulti[pi][ri][vi][1] , thismulti[pi][ri][vi][0]].slice();
                }
            }

            // done flipping coords for this polygon; add the polygon to multipolygon we're collecting
            // polygon = polygon.concat( outmulti[pi] );
            polygon = polygon.concat( outmulti[pi] );
        }
    }
    if (! polygon) return alert("No coal plants found in " + name);
    polygon = L.multiPolygon(polygon);
    var bounds;
    // some special cases. 
    // Comment: name here is the region, so actually would never be Russia or United States
    switch (name) {
        case 'Russia':
            bounds = L.latLngBounds([38.35400, 24.07004], [78.11962,178.88931]);
            break;
        case 'United States':
            bounds = L.latLngBounds([18.3, -172.6], [71.7,-67.4]);
            break;
        case 'North America':
            bounds = L.latLngBounds([18.3, -172.6], [81.7,-67.4]);
            break;
        case 'Eurasia':
            bounds = L.latLngBounds([38.35400, 24], [78.11962,178]);
            break;
        case 'Africa':
            bounds = L.latLngBounds([35.919, 63.466],[-35.3,-17.537]);
            break;
        default:
            bounds = polygon.getBounds();
            break;
    }
    MAP.fitBounds(bounds);
    MAPBOUNDS = bounds; // keep for later
    // step 2: empty the highlights, and recalculate the mask, load it in as COUNTRIES
    var rings = [];
    $.each( polygon.getLatLngs() , function () { rings.push(this.slice(0)); });
    rings.unshift(OUTERRING);
    L.polygon(rings, MASKSTYLE).addTo( MASK.clearLayers() );

    // step 3: clear the CLUSTERS marker custering system and repopulate it with tracker points
    // as we go through, log what statuses are in fact seen; this is used in step 5 to show/hide checkboxes for toggling trackers by status
    // as we go through, keep a list of the trackers for the table in step 4
    var statuses   = {};
    var trackers   = [];
    $.each(data_trackers.features, function () {
        // this is not a true Leaflet feature, just an entry in a GeoJSON-copmpatible data structure; that's why it's performant
        var feature = this;
        if (! countries[feature.properties.country]) return; // not one of the countries we figured out above

        var status = feature.properties.status;
        statuses[status] = true; // log that this status has been seen, see step 5 below

        // add the feature to the trackers list for the table
        trackers.push(feature);
    });

    // step 4a and 4b: update the table and the marker clustering, now that "trackers" is implicitly filtered to everything that we need
    populateMapWithTrackers(trackers);
    populateTableWithTrackers(trackers, name);

    // step 5: hide the status toggle checkboxes, showing only the ones which in fact have a status represented
    showLegendCheckboxes(statuses);

    // step 6: update the list of highlighted countries, used by the highlight hover effect, for DESKTOP only
    if (!ISMOBILE) {
        CURRENT_COUNTRIES = [];
        for (var c in countries) CURRENT_COUNTRIES.push( c.toLowerCase() );
        COUNTRIES.bringToFront();
    }
}

function searchCountry(name,data_countries,data_trackers) {
    // step 1: filter through the countries and find this one's boundary, then zoom to it
    // - massage it to always be a multipolygon so we're consistent
    // - some countries cross the date line and need a special bounding box
    // - the coordinates are backward
    // - some countries (okay, one) wrap the dateline and need their coords modified if lng > 180

    // Taiwan: special case
    if (name == 'Taiwan, China') name = 'Taiwan';

    var polygon, polygontype;
    var outpoly = [];
    for (var i=0, l=data_countries.features.length; i<l; i++) {
        if (data_countries.features[i].properties.NAME == name) {
            polygon     = data_countries.features[i].geometry.coordinates;
            polygontype = data_countries.features[i].geometry.type;
            break;
        }
    }
    if (! polygon) return alert("No coal plants found in " + name);

    if (polygontype == 'Polygon') polygon = [ polygon ];
    for (var pi=0, pl=polygon.length; pi<pl; pi++) {
        outpoly.push([]);
        for (var ri=0, rl=polygon[pi].length; ri<rl; ri++) {
            outpoly[pi].push([]);
            for (var vi=0, vl=polygon[pi][ri].length; vi<vl; vi++) {
                switch (name) {
                    case 'Russia':
                        if ( polygon[pi][ri][vi][0] < -0) polygon[pi][ri][vi][0] += 360;
                        break;
                }
                // slice to a new array to make sure we get a copy, not a reference! otherwise we flip coordinates on the original data!
                outpoly[pi][ri][vi] = [ polygon[pi][ri][vi][1] , polygon[pi][ri][vi][0]].slice();
            }
        }
    }
    polygon = L.multiPolygon(outpoly);

    var bounds;
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
        case 'Hong Kong, China':
            bounds = L.latLngBounds([22.1535, 113.8351], [22.5620, 114.4418]);
            break;        
        default:
            bounds = polygon.getBounds();
            break;
    }
    MAP.fitBounds(bounds);
    MAPBOUNDS = bounds; // keep for later

    // step 2: empty the highlights, and recalculate the mask, load it in as COUNTRIES
    var rings = [];
    $.each( polygon.getLatLngs() , function () { rings.push(this.slice(0)); });
    rings.unshift(OUTERRING);
    L.polygon(rings, MASKSTYLE).addTo( MASK.clearLayers() );

    // step 3: clear the CLUSTERS marker custering system and repopulate it with tracker points
    // as we go through, log what statuses are in fact seen; this is used in step 5 to show/hide checkboxes for toggling trackers by status
    // as we go through, keep a list of the trackers for the table in step 4
    var statuses   = {};
    var trackers   = [];
    $.each(data_trackers.features, function () {
        // this is not a true Leaflet feature, just an entry in a GeoJSON-copmpatible data structure; that's why it's performant
        var feature = this;
        if (feature.properties.country != name) return; // not relevant to our query


        // if (! feature.geometry) return;               // broken data left behind    GDA JSON file should not contain these invalid records; adjust import process

        // bail if no status defined in data, or an invalid one; dealing with bad data
        //GDA why is this necessary? clean up the JSON file to correct status to trimmed-lowercase (or use Proper Capitalization in STATUS_TYPES) and to remove invalid status
        var status = feature.properties.status;
        // if (!status || status == ' ' || STATUS_TYPES[status] == undefined) return;
        statuses[status] = true; // log that this status has been seen, see step 5 below

        // add the feature to the trackers list for the table
        trackers.push(feature);
    });

    // step 4a and 4b: update the table and the marker clustering, now that "trackers" is implicitly filtered to everything that we need
    populateMapWithTrackers(trackers);
    populateTableWithTrackers(trackers, name);

    // step 5: hide the status toggle checkboxes, showing only the ones which in fact have a status represented
    showLegendCheckboxes(statuses);

    // step 6: update the list of highlighted countries, used by the highlight hover effect
    if (!ISMOBILE) {
        CURRENT_COUNTRIES =  [ name.toLowerCase() ];
        COUNTRIES.bringToFront();
    }
}

function searchSubnational(name,country,data_countries,data_trackers) {
    // step 1 and 2: subnats do not have outlines, so we empty the country mask and zoom to it, and that's all
    MASK.clearLayers();
    var place = name + ", " + country;
    // use Bing to geocode the place name, and zoom to it
    // exceptions: Bing doesn't geocode certain chinese provinces correctly, so we trap those here
    switch (place) {
        case 'Inner Mongolia, China':
            MAPBOUNDS = L.latLngBounds([53.4357, 142.9980], [36.3859, 92.2412]);
            MAP.fitBounds(MAPBOUNDS);
            break;
        case 'Guangxi, China':
            MAPBOUNDS = L.latLngBounds([26.5393, 115.6201], [17.1050, 101.7993]);
            MAP.fitBounds(MAPBOUNDS);
            break;
        case 'Shanghai, China':
            MAPBOUNDS = L.latLngBounds([31.91253608, 122.2803344],[30.6426382, 120.825134]);
            MAP.fitBounds(MAPBOUNDS);
            break;
        default:
            _geocoder(place).done(function(response){
                zoomToBox(response.resourceSets[0].resources[0].bbox);
            }).fail(function(error){
                alert(error);
            });
            break;
    }

    // step 3: clear the CLUSTERS marker custering system and repopulate it with tracker points
    // as we go through, log what statuses are in fact seen; this is used in step 5 to show/hide checkboxes for toggling trackers by status
    // as we go through, keep a list of the trackers for the table in step 4
    var statuses   = {};
    var trackers   = [];
    $.each(data_trackers.features, function () {
        // this is not a true Leaflet feature, just an entry in a GeoJSON-copmpatible data structure; that's why it's performant
        var feature = this;
        if (feature.properties.country != country || feature.properties.subnational_unit != name) return; // not relevant to our query

        // if (! feature.geometry) return;               // broken data left behind    GDA JSON file should not contain these invalid records; adjust import process

        // bail if no status defined in data, or an invalid one; dealing with bad data
        //GDA why is this necessary? clean up the JSON file to correct status to trimmed-lowercase (or use Proper Capitalization in STATUS_TYPES) and to remove invalid status
        var status = feature.properties.status;
        // if (!status || status == ' ' || STATUS_TYPES[status] == undefined) return;
        statuses[status] = true; // log that this status has been seen, see step 5 below

        // add the feature to the trackers list for the table
        trackers.push(feature);
    });

    // step 4a and 4b: update the table and the marker clustering, now that "trackers" is implicitly filtered to everything that we need
    populateMapWithTrackers(trackers);
    populateTableWithTrackers(trackers, place);

    // step 5: hide the status toggle checkboxes, showing only the ones which in fact have a status represented
    showLegendCheckboxes(statuses);

    // step 6: update the list of highlighted countries, used by the highlight hover effect
    // it's not wholly accurate, but this subnat's country is the closest thing we have
    if (!ISMOBILE) {
        CURRENT_COUNTRIES =  [ country.toLowerCase() ];
        COUNTRIES.bringToFront();
    }
}

// show and hide the correct legend labels and checkboxes for this set of trackers
function showLegendCheckboxes(statuses) {
    $('#layers-trackers').show();
    var checkboxes = $('div.leaflet-control-layers-group input[type="checkbox"]');
    checkboxes.closest('label').hide();
    checkboxes.removeAttr('checked').filter('[data-check-after-search="true"]').prop('checked','checked');
    for (var s in statuses) checkboxes.filter('[value="'+s+'"]').closest('label').show();
}


///////////////////////////////////////////////////////////////////////////////////
///// SHIMS: Various polyfills to add functionality
///////////////////////////////////////////////////////////////////////////////////
// allows direct access to an objects values
// Object.values = function(obj) { Object.keys(obj).map(function(key) obj[key]) }; // e.g. Object.values(COLUMN_NAMES);

// trim() function
if(!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g,'');
  };
}

// simple capitalize
String.prototype.capitalize = function() { return this.charAt(0).toUpperCase() + this.slice(1); }

// check if a div has a horizontal scrollbar
$.fn.hasHorizontalScrollBar = function() { return this.get(0).scrollWidth > this.get(0).clientWidth; }

// get an object's keys
Object.keys||(Object.keys=function(){"use strict";var t=Object.prototype.hasOwnProperty,r=!{toString:null}.propertyIsEnumerable("toString"),e=["toString","toLocaleString","valueOf","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","constructor"],o=e.length;return function(n){if("object"!=typeof n&&("function"!=typeof n||null===n))throw new TypeError("Object.keys called on non-object");var c,l,p=[];for(c in n)t.call(n,c)&&p.push(c);if(r)for(l=0;o>l;l++)t.call(n,e[l])&&p.push(e[l]);return p}}());

// get string's proper case 
String.prototype.toTitleCase = function() {
    var i, j, str, lowers, uppers;
    str = this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    // Certain minor words should be left lowercase unless 
    // they are the first or last words in the string
    lowers = ['A', 'An', 'The', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At', 'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'Onto', 'To', 'With'];
    for (i = 0, j = lowers.length; i < j; i++)
    str = str.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'), 
        function(txt) {
            return txt.toLowerCase();
        });

    // Certain words such as initialisms or acronyms should be left uppercase
    uppers = ['Id', 'Tv'];
    for (i = 0, j = uppers.length; i < j; i++)
    str = str.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'), 
        uppers[i].toUpperCase());

    return str;
}

