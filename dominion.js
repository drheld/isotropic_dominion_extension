// TODO(drheld): Count duchies / dukes / etc here.
var special_counts = new Object();

var scores = new Object();
var decks = new Object();
var set_aside = new Object();
var native_village = new Object();
var gardens = new Object();

var deck_spot;
var points_spot;
var set_aside_spot;
var started = false;
var last_player = "";
var last_reveal_card = "";

function debugString() {
  return "[Scores: " + JSON.stringify(scores) + "] " +
         "[Cards: " + JSON.stringify(decks) + "]";
}

function pointsForCard(card) {
  if (card == undefined) {
    alert("Undefined card for points...");
    return 0;
  }
  if (card.indexOf("Colony") == 0) return 10;
  if (card.indexOf("Province") == 0) return 6;
  if (card.indexOf("Duchy") == 0) return 3;
  if (card.indexOf("Estate") == 0) return 1;
  if (card.indexOf("Curse") == 0) return -1;

  if (card.indexOf("Island") == 0) return 2;
  if (card.indexOf("Nobles") == 0) return 2;
  if (card.indexOf("Harem") == 0) return 2;
  if (card.indexOf("Great Hall") == 0) return 1;

  return 0;
}

function changeScore(player, points) {
  if (typeof scores[player] == "undefined") {
    scores[player] = 3;
  }
  if (typeof gardens[player] == "undefined") {
    gardens[player] = 0;
  }
  points = parseInt(points);
  scores[player] = scores[player] + points;
}

function gainCard(player, card, count) {
  if (player == null) return;
  count = parseInt(count);

  if (typeof decks[player] == "undefined") {
    decks[player] = 10;
  }

  if (card.indexOf("Gardens") == 0) {
    gardens[player] = gardens[player] + count;
  }

  changeScore(player, pointsForCard(card) * count);
  decks[player] = decks[player] + count;
}

function setAside(player, count, isNativeVillage) {
  if (player == null) return;
  count = parseInt(count);
  
  if (typeof decks[player] == "undefined") {
    decks[player] = 10;
  }

  if (typeof set_aside[player] == "undefined") {
    set_aside[player] = 0;
  }

  if (typeof native_village[player] == "undefined") {
    native_village[player] = 0;
  }

  decks[player] = decks[player] - count;
  set_aside[player] = set_aside[player] + count;
  if (isNativeVillage) {
    native_village[last_player] = native_village[last_player] + count;
  }
}

function findTrailingPlayer(text) {
  var arr = text.match(/ ([A-Za-z0-9]+)\./);
  if (arr.length == 2) {
    return arr[1];
  }
  return null;
}

function maybeHandleTurnChange(text) {
  if (text.indexOf("---") != -1) {
    // This must be a turn start.
    if (text.match(/Your turn/) != null) {
      last_player = "You";
    } else {
      var arr = text.match(/--- (.+)'s turn ---/);
      if (arr != null && arr.length == 2) {
        last_player = arr[1];
      } else {
        alert("Couldn't handle turn change: " + text);
      }
    }
    return true;
  }
  return false;
}

function maybeReturnToSupply(text) {
  if (text.indexOf("it to the supply") != -1) {
    gainCard(last_player, last_reveal_card, -1);
    return true;
  } else {
    var arr = text.match("([0-9]*) copies to the supply");
    if (arr != null && arr.length == 2) {
      gainCard(last_player, last_reveal_card, -arr[1]);
      return true;
    }
  }
  return false;
}

function maybeHandleSwindler(elems, text) {
  if (text.indexOf("replacing your") != -1) {
    if (elems.length == 2) {
      gainCard("You", elems[0].innerText, -1);
      gainCard("You", elems[1].innerText, 1);
    } else {
      alert("Replacing your has " + elems.length + " elements.");
    }
    return true;
  }
  if (text.indexOf("You replace") != -1) {
    if (elems.length == 2) {
      var arr = text.match("You replace ([^']*)'");
      if (arr != null && arr.length == 2) {
        gainCard(arr[1], elems[0].innerText, -1);
        gainCard(arr[1], elems[1].innerText, 1);
      } else {
        alert("Could not split: " + text);
      }
    } else {
      alert("Replacing your has " + elems.length + " elements.");
    }
    return true;
  }
  return false;
}

function maybeHandleSeaHag(elems, text_arr) {
  if (elems.length == 2 && pointsForCard(elems[1].innerText) == -1) {
    gainCard(text_arr[0], elems[1].innerText, 1);
    return true;
  }
}

function maybeHandleTrashing(elems, text, text_arr) {
  if (text_arr[0] == "trashing" ||  text_arr[1] == "trash") {
    for (elem in elems) {
      if (elems[elem].innerText != undefined) {
        var card = elems[elem].innerText;
        var count = getCardCount(card, text);
        gainCard(last_player, card, -count);
      }
    }
    return true;
  }
  return false;
}

function maybeHandleSetAside(text) {
  // Handle Island
  if (text.indexOf("set aside the") != -1 ||
      text.indexOf("setting aside the") != -1) {
    count = 2;
    setAside(last_player, count, false);
    return true;
  }

  // Handle Native Village
  if (text.indexOf("and add it to the") != -1 ||
      text.indexOf("placing it on the") != -1) {
    count = 1;
    setAside(last_player, count, true);
    return true;
  }
  if (text.indexOf("put the mat contents into") != -1 ||
      text.indexOf("from the Native Village mat") != -1) {
    count = native_village[last_player];
    setAside(last_player, -count, true);
    native_village[last_player] = 0;
    return true;
  }

  return false;
}

function maybeHandleVp(text) {
  var re = new RegExp("[+]([0-9]+) â–¼");
  var arr = (text.match(re));
  if (arr != null && arr.length == 2) {
    changeScore(last_player, arr[1]);
  }
}

function getCardCount(card, text) {
  var count = 1;
  var re = new RegExp("([0-9]+) " + card);
  var arr = (text.match(re));
  if (arr != null && arr.length == 2) {
    count = arr[1];
  }
  return count;
}

function handleLogEntry(node) {
  // Gaining VP could happen in combination with other stuff.
  maybeHandleVp(node.innerText);

  if (maybeHandleSetAside(node.innerText)) return;

  elems = node.getElementsByTagName("span");
  if (elems.length == 0) {
    if (maybeHandleTurnChange(node.innerText)) return;
    if (maybeReturnToSupply(node.innerText)) return;
    return;
  }

  // Remove leading stuff from the text.
  var text = node.innerText.split(" ");
  var i = 0;
  for (i = 0; i < text.length; i++) {
    if (text[i].match(/[A-Za-z0-9]/) != null) break;
  }
  if (i == text.length) return;
  text = text.slice(i);

  if (maybeHandleSwindler(elems, node.innerText)) return;
  if (maybeHandleSeaHag(elems, text)) return;
  if (maybeHandleTrashing(elems, node.innerText, text)) return;

  if (text[0] == "trashing" ||  text[1] == "trash") {
    for (elem in elems) {
      if (elems[elem].innerText != undefined) {
        var card = elems[elem].innerText;
        var count = getCardCount(card, node.innerText);
        gainCard(last_player, card, -count);
      }
    }
    return;
  }

  // Expect one element from here on out.
  if (elems.length > 1) return;

  // It's a single card action.
  var card = elems[0].innerText;

  if (text[0].indexOf("gaining") == 0) {
    var count = getCardCount(card, node.innerText);
    gainCard(last_player, card, count);
    return;
  }

  var player = text[0];
  var action = text[1];
  var delta = 0;
  if (action.indexOf("buy") == 0 || action.indexOf("gain") == 0) {
    var count = getCardCount(card, node.innerText);
    gainCard(player, card, count);
  } else if (action.indexOf("pass") == 0) {
    gainCard(player, card, -1);
    var other_player = findTrailingPlayer(node.innerText);
    gainCard(other_player, card, 1);
  } else if (action.indexOf("receive") == 0) {
    gainCard(player, card, 1);
    var other_player = findTrailingPlayer(node.innerText);
    gainCard(other_player, card, -1);
  } else if (action.indexOf("reveal") == 0) {
    last_reveal_card = card;
  }
}

function updateScores() {
  if (points_spot == undefined) return;
  var print_scores = "Points: "
  for (var score in scores) {
    var this_score = scores[score] + (Math.floor(decks[score] / 10) * gardens[score]);
    print_scores = print_scores + " " + score + "=" + this_score;
  }
  points_spot.innerHTML = print_scores;
}

function updateDeck() {
  if (deck_spot == undefined) return;
  var print_deck = "Cards: "
  for (var deck in decks) {
    print_deck = print_deck + " " + deck + "=" + decks[deck];
  }
  deck_spot.innerHTML = print_deck;
}

function updateSetAside() {
  if (set_aside_spot == undefined) return;
  var print_set_aside = "Set Aside: "
  for (var aside in set_aside) {
    print_set_aside = print_set_aside + " " + aside + "=" + set_aside[aside];
  }
  set_aside_spot.innerHTML = print_set_aside;
}

function initialize() {
  started = true;
  special_counts = new Object();
  scores = new Object();
  decks = new Object();
  set_aside = new Object();
  gardens = new Object();

  updateScores();
  updateDeck();
  updateSetAside();
}

function handle(doc) {
  if (doc.constructor == HTMLDivElement &&
      doc.innerText.indexOf("Say") == 0) {
    initialize();
    deck_spot = document.createElement("div");
    points_spot = document.createElement("div");
    set_aside_spot = document.createElement("div");
    doc.appendChild(deck_spot);
    doc.appendChild(points_spot);
    doc.appendChild(set_aside_spot);
  }

  if (doc.constructor == HTMLElement && doc.parentNode.id == "log" &&
      doc.innerText.indexOf("Turn order") != -1) {
    initialize();
  }

  if (started && doc.constructor == HTMLElement && doc.parentNode.id == "log") {
    handleLogEntry(doc);
  }

  if (started) {
    updateScores();
    updateDeck();
    updateSetAside();
  }
}


document.body.addEventListener('DOMNodeInserted', function(ev) {
  handle(ev.target);
});
