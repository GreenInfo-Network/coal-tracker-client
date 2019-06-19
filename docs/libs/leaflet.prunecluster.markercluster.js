// extends L.Icon to create a new Icon type for clusters. Used by PruneCluster to style marker clusters according
// to the number of markers they contain, and colored by the proportion of categories within
// resize with iconSize: new L.Point(22,22), but note you also need to scale radiusCenter to work with this
L.Icon.MarkerCluster = L.Icon.extend({
    options: {
        // iconSize: new L.Point(44, 44),
        iconSize: new L.Point(22, 22),
        className: 'prunecluster leaflet-markercluster-icon'
    },

    createIcon: function () {
        // based on L.Icon.Canvas from shramov/leaflet-plugins (BSD licence)
        var e = document.createElement('canvas');
        this._setIconStyles(e, 'icon');
        var s = this.options.iconSize;

        if (L.Browser.retina) {
            e.width = s.x + s.x;
            e.height = s.y + s.y;
        } else {
            e.width = s.x;
            e.height = s.y;
        }

        // this.draw(e.getContext('2d'), s.x, s.y);
        this.draw(e.getContext('2d'), e.width, e.height);
        return e;
    },

    createShadow: function () {
        return null;
    },

    draw: function(canvas, width, height) {

        var xa = 2, xb = 50, ya = 18, yb = 21;

        var r = ya + (this.population - xa) * ((yb - ya) / (xb - xa));

        var radiusMarker = Math.min(r, 21),
        // original : radiusCenter = 11,
        // ** this needs to scale with width/height
        radiusCenter = 7, 
        center = width / 2;

        if (L.Browser.retina) {
            canvas.scale(2, 2);
            center /= 2;
            canvas.lineWidth = 0.5;
        }

        // canvas.strokeStyle = 'rgba(0,0,0,0.25)';
        canvas.strokeStyle = 'rgba(255,255,255,0.99)'; // TFA

        var start = 0, stroke = true;
        for (var i = 0, l = window.markercluster_colors.length; i < l; ++i) {

            var size = this.stats[i] / this.population;

            if (size > 0) {

                // stroke set to true/false if size
                // will show between colors if more than one category
                stroke = size != 1; 

                canvas.beginPath();
                canvas.moveTo(center, center);
                canvas.fillStyle = window.markercluster_colors[i];
                // var from = start + 0.14, TFA
                var from = start + 0.05,
                to = start + size * (Math.PI * 2);

                if (to < from || size == 1) {
                    from = start;
                }
                canvas.arc(center, center, radiusMarker, from, to);

                start = start + size * (Math.PI * 2);
                canvas.lineTo(center, center);
                canvas.fill();
                if (stroke) {
                    canvas.stroke();
                }
                canvas.closePath();
            }

        }

        // not sure what this does, seems to have no effect?
        if (!stroke) {
            canvas.beginPath();
            canvas.arc(center, center, radiusMarker, 0, Math.PI * 2);
            canvas.stroke();
            canvas.closePath();
        }

        // white middle - draws on top of colored circle
        canvas.beginPath();
        canvas.fillStyle = 'white';
        canvas.moveTo(center, center);
        canvas.arc(center, center, radiusCenter, 0, Math.PI * 2);
        canvas.fill();
        canvas.closePath();

        // outer stroke TFA - does not work
        // canvas.fillStyle = 'rgba(0,0,0,0)'; // no fill
        // canvas.lineWidth = 5;
        // canvas.moveTo(center, center);
        // canvas.arc(center, center, radiusMarker, 0, Math.PI * 2);
        // canvas.strokeStyle = 'rgba(100,100,100,0.3)';
        // canvas.stroke;
        // canvas.closePath();

        // text
        canvas.fillStyle = '#454545';
        canvas.textAlign = 'center';
        canvas.textBaseline = 'middle';
        // canvas.font = 'bold '+(this.population < 100 ? '12' : (this.population < 1000 ? '11' : '9'))+'px sans-serif';
        canvas.font = 'bold '+(this.population < 100 ? '9' : (this.population < 1000 ? '8' : '7'))+'px sans-serif';

        canvas.fillText(this.population, center, center, radiusCenter*2);
    }
});
