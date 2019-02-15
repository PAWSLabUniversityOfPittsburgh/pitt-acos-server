$(function() {
  $('.annotated-example').each(function() {
    var element = $(this);
    var id = element.attr('data-id');

    var data = window.annotated;

    if (data[id]) {
      var counter = 0;

      $('<div></div>').appendTo(element).addClass('annotated-description').text(data[id].description);

      data[id].lines.forEach(function(line) {
        var lineDiv = $('<div></div>').appendTo(element).attr('data-line', ++counter);
        var toggleDiv = $('<div></div>').addClass('annotated-line-toggle').appendTo(lineDiv);

        if (line.comment) {
          $('<div></div>').appendTo(toggleDiv).text('?').attr('data-line', counter).click(function(e) {
            e.preventDefault();
            var button = $(this);
            element.find('.annotated-comment[data-line!="' + $(this).attr('data-line') + '"]').hide();
            element.find('.annotated-line-toggle div').text('?');
            var commentDiv = element.find('.annotated-comment[data-line="' + $(this).attr('data-line') + '"]');
            commentDiv.toggle(100, function() {
              if (commentDiv.is(':visible')) {
                button.text('-');
                if (window.ACOS) {
                  ACOS.sendEvent('line', $(this).attr('data-line'));
                  ACOS.sendEvent('log', { exampleId: id, type: 'open', line: $(this).attr('data-line') });
                }
              }

            });
          });
          lineDiv.after($('<div></div>').addClass('annotated-comment').text(line.comment).attr('data-line', counter).hide());
        }

        $('<div></div>').addClass('annotated-line-number').text(counter).appendTo(lineDiv);
        $('<div></div>').addClass('annotated-line-code').text(line.line).appendTo(lineDiv);

      });
    }
  });
});
