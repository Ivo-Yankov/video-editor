(function ( $ ) {
	$.editor = function() {
		$timeline = $('#timeline');

		var zoom = $timeline.attr('data-zoom') || 1,
			ruler_markers = 60,
			duration = 600,
			layer_width = 200;

		var duration_step = duration / ruler_markers;

		function renderLayers() {
			$('.layer').each(function(i,e) {
				$e = $(e);

				// set width
				$e.css('width', layer_width + "%");

				// render ruler
				$e.append ( renderRuler() );
			});

			// Process the media elements
			$('.layer-media').each(function(i,e) {
				$e = $(e);
				var start = parseFloat($e.attr('data-start'));
				var media_duration = parseFloat($e.attr('data-duration'));
				var new_left = ( start / duration * 100 );
				$e.css('left', new_left + "%" );
				$e.css('width', ( media_duration / duration * 100 ) + "%" ); 
			});

		}

		function renderRuler() {
			var $ruler = $('<div class="timeline-ruler"></div>');
			var $marker, time, time_string;

			for (var i = 1; i < ruler_markers; i++) {
				time = i * duration_step;
				time = time + ""; // Convert to a string
				$marker = $('<div class="ruler-marker">' + time.toHHMMSS() + '</div>')

				
				$marker.css('left', (time * 100 / duration) + "%");


				if (i % 5 == 0) {
					$marker.addClass('big');
				}


				$ruler.append($marker);
			}
			return $ruler;
		}

		renderLayers();

		return this;
	}
}( jQuery ));

$(function(){
	$.editor();
});


// Converts a string representing a number of seconds to the format hh:mm:ss
String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}