// Identifier for a card count for a given player.
function cardId(player_id, card_name) {
  return player_id + "_" + card_name.replace(/[^a-zA-Z]/gi, "").toLowerCase();
}


//
// TEXT MODE
//


// Any row that spans a number of columns should span the added columns.
// Use the attribute "grown" to avoid adjusting the same thing multiple times.
function growHeaderColumns() {
  var toAdd = player_count + 1;  // 1 extra for spacing

  $("#supply > table > tbody > tr > td[colspan]:not([grown])")
      .each(function() {
        var $this = $(this);
        var origSpanStr = $this.attr('colspan');
        var origSpan = parseInt(origSpanStr);
        $this.attr('colspan', (origSpan + toAdd));
        $this.attr('grown', toAdd);
      });
}

// Set up the card count cells for all players in text mode.
function setupPerPlayerTextCardCounts() {
  // Make sure things aren't already setup.
  if ($('#player1_copper').length != 0) return false;

  // For each row in the supply table, add a column count cell for each player.
  $(".txcardname").each(function() {
    var $this = $(this);
    var cardName = $this.children("[cardname]").first().attr('cardname');

    // Insert new cells after this one.
    var insertAfter = $this.next();
    for (var p in players) {
      var player = players[p];
      var id = cardId(player.id, cardName);
      var count = player.card_counts[cardName];
      if (count == undefined) count = '-';
      var cell = $('<td id="' + id + '">' + count + '</td>');
      cell.addClass("playerCardCountCol").addClass(player.id);
      insertAfter.after(cell);
      insertAfter = cell;
    }
    insertAfter.after($('<td class="availPadding"></td>'));
  });
  growHeaderColumns();
  return true;
}
