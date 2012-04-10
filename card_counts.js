// Identifier for a card count for a given player.
function cardId(player_id, card_name) {
  return player_id + "_" + card_name.replace(/[^a-zA-Z]/gi, "").toLowerCase();
}

// Sets up the per player card count layout.
// Returns true if this call set it up, or false if it was already setup.
function setupPerPlayerCardCounts() {
  if (!getOption("show_card_counts")) return true;
  if (turn_number < 2) return true;

  // Make sure things aren't already setup.
  if ($('#player1_copper').length != 0) return false;

  if ($('#chat ~ a[href^="/mode/"]').text() == "images") {
    setupPerPlayerTextCardCounts();

    // Setup the counts again whenever the table is recreated.
    $("#supply").bind("DOMNodeInserted", function(e) {
      if (e.target.constructor == HTMLTableElement) {
        if ($('#player1_copper').length == 0) {
          setupPerPlayerTextCardCounts();
        }
      }
    });
  } else {
    setupPerPlayerImageCardCounts('kingdom');
    setupPerPlayerImageCardCounts('basic');

    // Setup the counts again whenever the table is recreated.
    $("#supply").bind("DOMNodeInserted", function(e) {
      if (e.target.constructor == HTMLTableElement) {
        if ($('#player1_copper').length == 0) {
          setupPerPlayerImageCardCounts('kingdom');
          setupPerPlayerImageCardCounts('basic');
        }
      }
    });
  }
  return true;
}

// Creates an appropriately IDd table cell for a card/player.
function createPlayerCardCountCell(player, card) {
  var id = cardId(player.id, card);
  var count = player.card_counts[card];
  if (count == undefined) count = '-';
  var cell = $('<td id="' + id + '">' + count + '</td>');
  cell.addClass("playerCardCountCol").addClass(player.id);
  return cell;
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
  // For each row in the supply table, add a column count cell for each player.
  $(".txcardname").each(function() {
    var $this = $(this);
    var cardName = $this.children("[cardname]").first().attr('cardname');

    // Insert new cells after this one.
    var insertAfter = $this.next();
    for (var p in players) {
      var cell = createPlayerCardCountCell(players[p], cardName);
      insertAfter.after(cell);
      insertAfter = cell;
    }
    insertAfter.after($('<td class="availPadding"></td>'));
  });
  growHeaderColumns();
}


//
// GRAPHIC MODE
//

// Set up the per-player card counts in image mode for a given column.
function setupPerPlayerImageCardCounts(region) {
  var selector = '.' + region + '-column';

  // make "hr" rows span all columns
  var numPlayers = 1 + player_count;
  $(selector + ' .hr:empty').append('<td colspan="' + numPlayers + '"></td>');

  $(selector + ' .supplycard').each(function() {
    var $this = $(this);
    var cardName = $this.attr('cardname');
    for (var p in players) {
      $this.append(createPlayerCardCountCell(players[p], cardName));
    }
  });
}
