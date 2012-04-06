// For players who have spaces in their names, a map from name to name
// rewritten to have underscores instead. Pretty ugly, but it works.
var player_rewrites = new Object();

// Map from player name to Player object.
var players = new Object();
// Regular expression that is an OR of players other than "You".
var player_re = "";
// Count of the number of players in the game.
var player_count = 0;
var self_index = -1;
var other_player_names = [];

// Places to print number of cards and points.
var deck_spot;
var points_spot;

var started = false;
var introduced = false;
var i_introduced = false;
var disabled = false;
var had_error = false;
var show_action_count = false;
var show_unique_count = false;
var show_victory_count = false;
var show_duchy_count = false;
var possessed_turn = false;
var announced_error = false;

// Enabled by debugger when analyzing game logs.
var debug_mode = false;

var last_player = null;
var last_reveal_player = null;
var last_reveal_card = null;

// TODO(drheld): Remove this.
// Hack currently needed due to lack of info with embargo + trader.
var last_gain_card = null;

var turn_number = 0;

// Last time a status message was printed.
var last_status_print = 0;

// Track scoping to know currently "active" player.
var scopes = [];

// The version of the extension currently loaded.
var extension_version = 'Unknown';

var restoring_log = false;

// Quotes a string so it matches literally in a regex.
RegExp.quote = function(str) {
  return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
};

// Returns an html encoded version of a string.
function htmlEncode(value){
  return $('<div/>').text(value).html();
}


// Keep a map from plural to singular for cards that need it.
var plural_map = {};
for (var i = 0; i < card_list.length; ++i) {
  var card = card_list[i];
  if (card['Plural'] != card['Singular']) {
    plural_map[card['Plural']] = card['Singular'];
  }
}

function debugString(thing) {
  return JSON.stringify(thing);
}

function rewriteName(name) {
  return name.replace(/ /g, "_").replace(/'/g, "’").replace(/\./g, "۔").
              replace(/\|/g, "¦");
}

function handleError(text) {
  console.log(text);
  if (!had_error) {
    had_error = true;
    alert("Point counter error. Results may no longer be accurate: " + text);
  }
}

function getSayButton() {
  var blist = document.getElementsByTagName('button');
  for (var button in blist) {
    if (blist[button].innerText == "Say") {
      return blist[button];
    }
  }
  return null;
}

function writeText(text) {
  // Get the fields we need for being able to write text.
  var input_box = document.getElementById("entry");
  var say_button = getSayButton();

  if (input_box == null || input_box == undefined || !say_button) {
    handleError("Can't write text -- button or input box is unknown.");
    return;
  }
  var old_input_box_value = input_box.value;
  input_box.value = text;
  say_button.click();
  input_box.value = old_input_box_value;
}

function maybeAnnounceFailure(text) {
  if (!disabled && !announced_error) {
    console.log("Logging error: " + text);
    writeText(text);
  }
  announced_error = true;
}

function pointsForCard(card_name) {
  if (card_name == undefined) {
    handleError("Undefined card for points...");
    return 0;
  }
  if (card_name.indexOf("Colony") == 0) return 10;
  if (card_name.indexOf("Province") == 0) return 6;
  if (card_name.indexOf("Duchy") == 0) return 3;
  if (card_name.indexOf("Duchies") == 0) return 3;
  if (card_name.indexOf("Estate") == 0) return 1;
  if (card_name.indexOf("Curse") == 0) return -1;

  if (card_name.indexOf("Island") == 0) return 2;
  if (card_name.indexOf("Nobles") == 0) return 2;
  if (card_name.indexOf("Harem") == 0) return 2;
  if (card_name.indexOf("Great Hall") == 0) return 1;

  if (card_name.indexOf("Farmland") == 0) return 2;
  if (card_name.indexOf("Tunnel") == 0) return 2;
  return 0;
}

function Player(name) {
  this.name = name;
  this.score = 3;
  this.deck_size = 10;

  // Map from special counts (such as number of gardens) to count.
  this.special_counts = { "Treasure" : 7, "Victory" : 3, "Uniques" : 2 };
  this.card_counts = { "Copper" : 7, "Estate" : 3 };

  this.getScore = function() {
    var score_str = this.score;
    var total_score = this.score;

    if (this.card_counts["Gardens"] != undefined) {
      var gardens = this.card_counts["Gardens"];
      var garden_points = Math.floor(this.deck_size / 10);
      score_str = score_str + "+" + gardens + "g@" + garden_points;
      total_score = total_score + gardens * garden_points;
    }

    if (this.card_counts["Silk Road"] != undefined) {
      var silk_roads = this.card_counts["Silk Road"];
      var silk_road_points = 0;
      if (this.special_counts["Victory"] != undefined) {
        silk_road_points = Math.floor(this.special_counts["Victory"] / 4);
      }
      score_str = score_str + "+" + silk_roads + "s@" + silk_road_points;
      total_score = total_score + silk_roads * silk_road_points;
    }

    if (this.card_counts["Duke"] != undefined) {
      var dukes = this.card_counts["Duke"];
      var duke_points = 0;
      if (this.card_counts["Duchy"] != undefined) {
        duke_points = this.card_counts["Duchy"];
      }
      score_str = score_str + "+" + dukes + "d@" + duke_points;
      total_score = total_score + dukes * duke_points;
    }

    if (this.card_counts["Vineyard"] != undefined) {
      var vineyards = this.card_counts["Vineyard"];
      var vineyard_points = 0;
      if (this.special_counts["Actions"] != undefined) {
        vineyard_points = Math.floor(this.special_counts["Actions"] / 3);
      }
      score_str = score_str + "+" + vineyards + "v@" + vineyard_points;
      total_score = total_score + vineyards * vineyard_points;
    }

    if (this.card_counts["Fairgrounds"] != undefined) {
      var fairgrounds = this.card_counts["Fairgrounds"];
      var fairgrounds_points = 0;
      if (this.special_counts["Uniques"] != undefined) {
        fairgrounds_points = Math.floor(this.special_counts["Uniques"] / 5) * 2;
      }
      score_str = score_str + "+" + fairgrounds + "f@" + fairgrounds_points;
      total_score = total_score + fairgrounds * fairgrounds_points;
    }

    if (total_score != this.score) {
      score_str = score_str + "=" + total_score;
    }
    return score_str;
  }

  this.getDeckString = function() {
    var str = this.deck_size;
    var need_action_string = (show_action_count && this.special_counts["Actions"]);
    var need_unique_string = (show_unique_count && this.special_counts["Uniques"]);
    var need_victory_string = (show_victory_count && this.special_counts["Victory"]);
    var need_duchy_string = (show_duchy_count && this.card_counts["Duchy"]);
    if (need_action_string || need_unique_string || need_duchy_string || need_victory_string) {
      var special_types = [];
      if (need_unique_string) {
        special_types.push(this.special_counts["Uniques"] + "u");
      }
      if (need_action_string) {
        special_types.push(this.special_counts["Actions"] + "a");
      }
      if (need_duchy_string) {
        special_types.push(this.card_counts["Duchy"] + "d");
      }
      if (need_victory_string) {
        special_types.push(this.special_counts["Victory"] + "v");
      }
      str += '(' + special_types.join(", ") + ')';
    }
    return str;
  }

  this.changeScore = function(points) {
    this.score = this.score + parseInt(points);
  }

  this.changeSpecialCount = function(name, delta) {
    if (this.special_counts[name] == undefined) {
      this.special_counts[name] = 0;
    }
    this.special_counts[name] = this.special_counts[name] + delta;
  }

  this.recordCards = function(name, count) {
    if (this.card_counts[name] == undefined || this.card_counts[name] == 0) {
      this.card_counts[name] = count;
      this.special_counts["Uniques"] += 1;
    } else {
      this.card_counts[name] += count;
    }

    if (this.card_counts[name] <= 0) {
      if (this.card_counts[name] < 0) {
        handleError("Card count for " + name + " is negative (" + this.card_counts[name] + ")");
      }
      delete this.card_counts[name];
      this.special_counts["Uniques"] -= 1;
    }
  }

  this.recordSpecialCounts = function(singular_card_name, card, count) {
    // Hack! Hinterlands adds reactions that are not actions. Currently there
    // is no easy way to see this based on the class names. I've made a request
    // to change this but for now special case them. :(
    if (singular_card_name == "Tunnel") {
      this.changeSpecialCount("Victory", count);
      return;
    }
    if (singular_card_name == "Fool's Gold") {
      this.changeSpecialCount("Treasure", count);
      return;
    }

    var types = card.className.split("-").slice(1);
    for (type_i in types) {
      var type = types[type_i];
      if (type == "none" || type == "duration" ||
          type == "action" || type == "reaction") {
        this.changeSpecialCount("Actions", count);
      } else if (type == "curse") {
        this.changeSpecialCount("Curse", count);
      } else if (type == "victory") {
        this.changeSpecialCount("Victory", count);
      } else if (type == "treasure") {
        this.changeSpecialCount("Treasure", count);
      } else {
        handleError("Unknown card class: " + card.className + " for " + card.innerText);
      }
    }
  }

  this.gainCard = function(card, count) {
    // You can't gain or trash cards while possessed.
    if (possessed_turn && this == last_player) return;

    if (debug_mode) {
      $('#log').children().eq(-1).before(
          '<div class="gain_debug">*** ' + name + " gains " +
          count + " " + card.innerText + "</div>");
    }

    // Last scope should be this player.
    scopes[scopes.length - 1] = this;

    count = parseInt(count);
    this.deck_size = this.deck_size + count;

    var singular_card_name = getSingularCardName(card.innerText);
    this.changeScore(pointsForCard(singular_card_name) * count);
    this.recordSpecialCounts(singular_card_name, card, count);
    this.recordCards(singular_card_name, count);

    last_gain_card = singular_card_name;

    if (getOption('show_card_counts')) {
      if (!setupPerPlayerCardCounts()) {
        var id = '#' + cardId(this.id, singular_card_name);
        $(id).text(this.card_counts[singular_card_name]);
      }
    }
  }
}

function stateStrings() {
  var state = '';
  for (var player in players) {
    player = players[player];
    state += '<b>' + player.name + "</b>: " +
        player.getScore() + " points [deck size is " +
        player.getDeckString() + "] - " +
        JSON.stringify(player.special_counts) + "<br>" +
        JSON.stringify(player.card_counts) + "<br>";
  }
  return state;
}

function getSingularCardName(name) {
  if (plural_map[name] == undefined) return name;
  return plural_map[name];
}

function getPlayer(name) {
  if (players[name] == undefined) return null;
  return players[name];
}

function createFullLog() {
  // Create the visible log blob and hide the normal log part.
  $('#full_log').remove();
  $('#log').hide().before($('<pre id="full_log">'));
}

function maybeAddToFullLog(node) {
  if (!restoring_log) {
    $('#copied_temp_say').remove();
    $('#full_log').append($(node).clone());
  }
}

function findTrailingPlayer(text) {
  var arr = text.match(/ ([^\s.]+)\.[\s]*$/);
  if (arr == null) {
    handleError("Couldn't find trailing player: '" + text + "'");
    return null;
  }
  if (arr.length == 2) {
    return getPlayer(arr[1]);
  }
  return null;
}

function maybeInitializePlayerFromFirstTurn(node) {
  var text = node.innerText;
  if (text.indexOf("—") != -1) {
    var maybe_number = text.match(/([0-9]+) —/);
    if (maybe_number) turn_number = maybe_number[1];
    // This must be a turn start.

    // if this isn't a first turn, go straight to handling this like a regular turn instead
    if(turn_number != 1) {
      return false;
    }
    // If it's your turn, add you as a yourself
    if (text.match(/— Your (?:extra )?turn/)) {
      player_count++;
      self_index = player_count;
      var arr = "You";
      players[arr] = new Player(arr);
      players[arr].id = "player" + player_count;
      last_player = getPlayer("You");
    } else {
      var arr = text.match(/— (.+)'s .*turn/);
      if (arr && arr.length == 2) {
        player_count++;
        // Hack: collect player names with special characters that hurt us. We'll
        // rewrite them and then all the text parsing works as normal.
        var rewritten = rewriteName(arr[1]);
        if (rewritten != arr[1]) {
          player_rewrites[htmlEncode(arr[1])] = htmlEncode(rewritten);
          arr[1] = rewritten;
        }
        // Initialize the player.
        players[arr[1]] = new Player(arr[1]);
        players[arr[1]].id = "player" + player_count;
        other_player_names.push(RegExp.quote(arr[1]));
        last_player = getPlayer(arr[1]);
        player_re = '(' + other_player_names.join('|') + ')';
      } else {
        handleError("Couldn't handle turn change: " + text);
      }
    }

    if (last_player == null) {
      console.log("Failed to initialize player from: " + node.innerText);
    } else {
      $('#full_log :last').addClass(last_player.id);
    }

    if (debug_mode) {
      var details = " (" + getDecks() + " | " + getScores() + ")";
      node.innerHTML.replace(" —<br>", " " + details + " —<br>");
    }

    return true;
  }
  return false;
}

function maybeHandleTurnChange(node) {
  var text = node.innerText;
  if (text.indexOf("—") != -1) {
    var maybe_number = text.match(/([0-9]+) —/);
    if (maybe_number) turn_number = maybe_number[1];

    // This must be a turn start.
    if (text.match(/— Your (?:extra )?turn/)) {
      last_player = getPlayer("You");
    } else {
      var arr = text.match(/— (.+)'s .*turn/);
      if (arr && arr.length == 2) {
        last_player = getPlayer(arr[1]);
      } else {
        handleError("Couldn't handle turn change: " + text);
      }
    }

    if (last_player == null) {
      console.log("Failed to get player from: " + node.innerText);
    } else {
      $('#full_log :last').addClass(last_player.id);
    }

    possessed_turn = text.match(/\(possessed by .+\)/);

    if (debug_mode) {
      var details = " (" + getDecks() + " | " + getScores() + ")";
      node.innerHTML.replace(" —<br>", " " + details + " —<br>");
    }

    return true;
  }
  return false;
}

function handleScoping(text_arr, text) {
  // Ignore debug output.
  if (text_arr[0] == "***") return;

  var depth = 0;
  for (var t in text_arr) {
    if (text_arr[t] == "...") ++depth;
  }
  while (depth < scopes.length) {
    scopes.pop();
  }

  scopes.push(getPlayer(text_arr[depth]));
}

function maybeReturnToSupply(text) {
  possessed_turn_backup = possessed_turn;
  possessed_turn = false;

  var ret = false;
  if (text.indexOf("it to the supply") != -1) {
    last_player.gainCard(last_reveal_card, -1);
    ret = true;
  } else {
    var arr = text.match("([0-9]*) copies to the supply");
    if (arr && arr.length == 2) {
      last_player.gainCard(last_reveal_card, -arr[1]);
      ret = true;
    }
  }

  possessed_turn = possessed_turn_backup;
  return false;
}

function maybeHandleExplorer(elems, text) {
  if (text.match(/gain(ing)? a (Silver|Gold) in (your )?hand/)) {
    last_player.gainCard(elems[elems.length - 1], 1);
    return true;
  }
  return false;
}

function maybeHandleMint(elems, text) {
  if (elems.length != 1) return false;
  if (text.match("and gain(ing)? another one.")) {
    last_player.gainCard(elems[0], 1);
    return true;
  }
  return false;
}

function maybeHandleTradingPost(elems, text) {
  if (text.indexOf(", gaining a Silver in hand") == -1) {
    return false;
  }
  if (elems.length != 2 && elems.length != 3) {
    handleError("Error on trading post: " + text);
    return true;
  }
  var elem = 0;
  last_player.gainCard(elems[0], -1);
  if (elems.length == 3) elem++;
  last_player.gainCard(elems[elem++], -1);
  last_player.gainCard(elems[elem], 1);
  return true;
}

function maybeHandleSwindler(elems, text) {
  var player = null;
  if (text.indexOf("replacing your") != -1) {
    player = getPlayer("You");
  }
  var arr = text.match(new RegExp("You replace " + player_re + "'s"));
  if (!arr) arr = text.match(new RegExp("replacing " + player_re + "'s"));
  if (arr && arr.length == 2) {
    player = getPlayer(arr[1]);
  }

  if (player) {
    if (elems.length == 2) {
      // Note: no need to subtract out the swindled card. That was already
      // handled by maybeHandleOffensiveTrash.
      player.gainCard(elems[1], 1);
    } else {
      handleError("Replacement has " + elems.length + " elements: " + text);
    }
    return true;
  }
  return false;
}

function maybeHandlePirateShip(elems, text_arr, text) {
  // Swallow gaining pirate ship tokens.
  // It looks like gaining a pirate ship otherwise.
  if (text.indexOf("a Pirate Ship token") != -1) return true;
  return false;
}

function maybeHandleSeaHag(elems, text_arr, text) {
  if (text.indexOf("a Curse on top of") != -1) {
    if (elems < 1 || elems[elems.length - 1].innerHTML != "Curse") {
      handleError("Weird sea hag: " + text);
      return false;
    }
    getPlayer(text_arr[0]).gainCard(elems[elems.length - 1], 1);
    return true;
  }
  return false;
}

// This can be triggered by Saboteur, Swindler, and Pirate Ship.
function maybeHandleOffensiveTrash(elems, text_arr, text) {
  if (elems.length == 1) {
    if (text.indexOf("is trashed.") != -1) {
      last_reveal_player.gainCard(elems[0], -1);
      return true;
    }
    if (text.indexOf("and trash it.") != -1 ||
        text.indexOf("and trashes it.") != -1) {
      getPlayer(text_arr[0]).gainCard(elems[0], -1);
      return true;
    }

    if (text.match(/trashes (?:one of )?your/)) {
      last_reveal_player.gainCard(elems[0], -1);
      return true;
    }

    var arr = text.match(new RegExp("trash(?:es)? (?:one of )?" + player_re + "'s"));
    if (arr && arr.length == 2) {
      getPlayer(arr[1]).gainCard(elems[0], -1);
      return true;
    }
    return false;
  }
}

function maybeHandleTournament(elems, text_arr, text) {
  if (elems.length == 2 && text.match(/and gains? a .+ on (the|your) deck/)) {
    getPlayer(text_arr[0]).gainCard(elems[1], 1);
    return true;
  }
  return false;
}

function maybeHandleTrader(elems, text_arr, text) {
  if (elems.length == 3 && text.match(/a Trader to gain a Silver/)) {
    if (getSingularCardName(elems[2].innerText) == "Curse" &&
        last_gain_card != "Curse") {
      // HACK: There is no message about gaining the curse so don't lose it.
      return true;
    }

    getPlayer(text_arr[0]).gainCard(elems[2], -1);
    return true;
  }
  return false;
}

function maybeHandleTunnel(elems, text_arr, text) {
  if (elems.length == 2 && text.match(/reveals? a Tunnel and gain/)) {
    getPlayer(text_arr[0]).gainCard(elems[1], 1);
    return true;
  }
  if (elems.length == 2 && text.match(/revealing a Tunnel and gaining/)) {
    last_player.gainCard(elems[1], 1);
    return true;
  }
  return false;
}

function maybeHandleNobleBrigand(elems, text_arr, text) {
  if (text.match(/draws? and reveals?.+, trashing a/)) {
    getPlayer(text_arr[0]).gainCard(elems[elems.length - 1], -1);
    return true;
  }
  return false;
}

function maybeHandleVp(text) {
  var re = new RegExp("[+]([0-9]+) ▼");
  var arr = text.match(re);
  if (arr && arr.length == 2) {
    last_player.changeScore(arr[1]);
  }
}

function getCardCount(card, text) {
  var count = 1;
  var re = new RegExp("([0-9]+) " + card);
  var arr = text.match(re);
  if (arr && arr.length == 2) {
    count = arr[1];
  }
  return count;
}

function handleGainOrTrash(player, elems, text, multiplier) {
  for (elem in elems) {
    if (elems[elem].innerText != undefined) {
      var card = elems[elem].innerText;
      var count = getCardCount(card, text);
      player.gainCard(elems[elem], multiplier * count);
    }
  }
}

function maybeHandleGameStart(node) {
  var nodeText = node.innerText;
  if (nodeText == null || nodeText.indexOf("Turn order") != 0) {
    return false;
  }
  initialize(node);
  maybeAddToFullLog(node);
  return true;
}

function handleLogEntry(node) {
  if (maybeHandleGameStart(node)) return;

  if (!started) return;

  maybeAddToFullLog(node);
  maybeRewriteName(node);

  if (maybeInitializePlayerFromFirstTurn(node)) return;

  if (maybeHandleTurnChange(node)) return;

  // Make sure this isn't a duplicate possession entry.
  if (node.className.indexOf("possessed-log") > 0) return;

  var text = node.innerText.split(" ");

  // Keep track of what sort of scope we're in for things like watchtower.
  handleScoping(text);

  // Gaining VP could happen in combination with other stuff.
  maybeHandleVp(node.innerText);

  elems = node.getElementsByTagName("span");
  if (elems.length == 0) {
    if (maybeReturnToSupply(node.innerText)) return;
    return;
  }

  // Remove leading stuff from the text.
  var i = 0;
  for (i = 0; i < text.length; i++) {
    if (!text[i].match(/^[. ]*$/)) break;
  }
  if (i == text.length) return;
  text = text.slice(i);

  if (maybeHandleMint(elems, node.innerText)) return;
  if (maybeHandleTradingPost(elems, node.innerText)) return;
  if (maybeHandleExplorer(elems, node.innerText)) return;
  if (maybeHandleSwindler(elems, node.innerText)) return;
  if (maybeHandlePirateShip(elems, text, node.innerText)) return;
  if (maybeHandleSeaHag(elems, text, node.innerText)) return;
  if (maybeHandleOffensiveTrash(elems, text, node.innerText)) return;
  if (maybeHandleTournament(elems, text, node.innerText)) return;
  if (maybeHandleTrader(elems, text, node.innerText)) return;
  if (maybeHandleTunnel(elems, text, node.innerText)) return;
  if (maybeHandleNobleBrigand(elems, text, node.innerText)) return;

  if (text[0] == "trashing") {
    var player = last_player;
    if (scopes.length >= 2 && scopes[scopes.length - 2] != null) {
      player = scopes[scopes.length - 2];
    }
    return handleGainOrTrash(player, elems, node.innerText, -1);
  }
  if (text[1].indexOf("trash") == 0) {
    return handleGainOrTrash(getPlayer(text[0]), elems, node.innerText, -1);
  }
  if (text[0] == "gaining") {
    var player = last_player;
    if (scopes.length >= 2 && scopes[scopes.length - 2] != null) {
      player = scopes[scopes.length - 2];
    }
    return handleGainOrTrash(player, elems, node.innerText, 1);
  }
  if (text[1].indexOf("gain") == 0) {
    return handleGainOrTrash(getPlayer(text[0]), elems, node.innerText, 1);
  }

  var player = getPlayer(text[0]);
  var action = text[1];

  // Handle revealing cards.
  if (action.indexOf("reveal") == 0) {
    last_reveal_player = player;
    last_reveal_card = elems[elems.length - 1];
  }

  // Expect one element from here on out.
  if (elems.length > 1) return;

  // It's a single card action.
  var card = elems[0];
  var card_text = elems[0].innerText;

  if (action.indexOf("buy") == 0) {
    var count = getCardCount(card_text, node.innerText);
    player.gainCard(card, count);
  } else if (action.indexOf("pass") == 0) {
    possessed_turn_backup = possessed_turn;
    possessed_turn = false;
    if (possessed_turn && this == last_player) return;
    if (player_count != 2) {
      maybeAnnounceFailure(">> Warning: Masquerade with more than 2 players " +
                           "causes inaccurate score counting.");
    }
    player.gainCard(card, -1);
    var other_player = findTrailingPlayer(node.innerText);
    if (other_player == null) {
      handleError("Could not find trailing player from: " + node.innerText);
    } else {
      other_player.gainCard(card, 1);
    }
    possessed_turn = possessed_turn_backup;
  } else if (action.indexOf("receive") == 0) {
    possessed_turn_backup = possessed_turn;
    possessed_turn = false;
    player.gainCard(card, 1);
    var other_player = findTrailingPlayer(node.innerText);
    if (other_player == null) {
      handleError("Could not find trailing player from: " + node.innerText);
    } else {
      other_player.gainCard(card, -1);
    }
    possessed_turn = possessed_turn_backup;
  }
}

function getScores() {
  var scores = "Points: ";
  for (var player in players) {
    scores = scores + " " + player + "=" + players[player].getScore();
  }
  return scores;
}

function updateScores() {
  if (points_spot == undefined) {
    var spot = $('a[href="http://dominion.isotropic.org/faq/"]');
    if (spot.length != 1) return;
    points_spot = spot[0];
    return;
  }
  points_spot.innerHTML = getScores();
}

function getDecks() {
  var decks = "Cards: ";
  for (var player in players) {
    decks = decks + " " + player + "=" + players[player].getDeckString();
  }
  return decks;
}

function updateDeck() {
  if (deck_spot == undefined) {
    var spot = $('a[href="/signout"]');
    if (spot.length != 1) return;
    deck_spot = spot[0];
  }
  deck_spot.innerHTML = getDecks();
}

function initialize(doc) {
  started = true;
  introduced = false;
  i_introduced = false;
  disabled = false;
  had_error = false;
  possessed_turn = false;
  announced_error = false;
  turn_number = 0;

  scopes = [];

  players = new Object();
  player_rewrites = new Object();
  player_re = "";
  player_count = 0;

  if (localStorage.getItem("disabled")) {
    disabled = true;
  }

  if (!disabled && getOption("always_display")) {
    updateScores();
    updateDeck();
  }

  // Figure out what turn we are. We'll use that to figure out how long to wait
  // before announcing the extension.
  // var self_index = -1;

  // // var arr;
  // // if (doc.innerText == "Turn order is you.") {
  // //   arr = [undefined, "you"];
  // // } else {
  // //   var p = "(?:([^,]+), )";    // an optional player
  // //   var pl = "(?:([^,]+),? )";  // the last player (might not have a comma)
  // //   var re = new RegExp("Turn order is "+p+"?"+p+"?"+p+"?"+pl+"and then (.+).");
  // //   arr = doc.innerText.match(re);
  // // }
  // // if (arr == null) {
  // //   handleError("Couldn't parse: " + doc.innerText);
  // // }
  // var other_player_names = [];
  // for (var i = 1; i < arr.length; ++i) {
  //   if (arr[i] == undefined) continue;

  //   player_count++;
  //   if (arr[i] == "you") {
  //     self_index = player_count;
  //     arr[i] = "You";
  //   }
  //   // Hack: collect player names with special characters that hurt us. We'll
  //   // rewrite them and then all the text parsing works as normal.
  //   var rewritten = rewriteName(arr[i]);
  //   if (rewritten != arr[i]) {
  //     player_rewrites[htmlEncode(arr[i])] = htmlEncode(rewritten);
  //     arr[i] = rewritten;
  //   }
  //   // Initialize the player.
  //   players[arr[i]] = new Player(arr[i]);
  //   players[arr[i]].id = "player" + player_count;

  //   if (arr[i] != "You") {
  //     other_player_names.push(RegExp.quote(arr[i]));
  //   }
  // }
  // player_re = '(' + other_player_names.join('|') + ')';

  // Assume it's already introduced if it's rewriting the tree for a reload.
  // Otherwise setup to maybe introduce the extension.
  if (!restoring_log) {
    var wait_time = 200 * Math.floor(Math.random() * 10 + 5);
    if (self_index != -1) {
      wait_time = 300 * self_index;
    }
    console.log("Waiting " + wait_time + " to introduce " +
        "(index is: " + self_index + ").");
    setTimeout("maybeIntroducePlugin()", wait_time);
  }

  if (getOption('show_card_counts')) {
    setupPerPlayerCardCounts();
  }

  $('#full_log').append('<div style="height: 60em"></div>');
}

function maybeRewriteName(doc) {
  if (doc.innerHTML != undefined && doc.innerHTML != null) {
    for (player in player_rewrites) {
      doc.innerHTML = doc.innerHTML.replace(player, player_rewrites[player]);
    }
  }
}

function maybeIntroducePlugin() {
  if (!introduced && !disabled) {
    writeText("★ Game scored by Dominion Point Counter ★");
    writeText("http://goo.gl/iDihS");
    writeText("Type !status to see the current score.");
    writeText("Type !details to see deck details for each player.");
    if (getOption("allow_disable")) {
      writeText("Type !disable by turn 5 to disable the point counter.");
    }
  }
}

function maybeShowStatus(request_time) {
  if (last_status_print < request_time) {
    last_status_print = new Date().getTime();
    var to_show = ">> " + getDecks() + " | " + getScores();
    var my_name = localStorage["name"];
    if (my_name == undefined || my_name == null) my_name = "Me";
    writeText(to_show.replace(/You=/g, my_name + "="));
  }
}

function maybeShowDetails(request_time) {
  if (last_status_print < request_time) {
    last_status_print = new Date().getTime();

    var my_name = localStorage["name"];
    if (my_name == undefined || my_name == null) my_name = "Me";

    for (var player in players) {
      player = players[player];
      var name = player.name == "You" ? my_name : player.name;
      writeText('>> *' + name + '* => ' + player.getScore() +
                ' points [deck size is ' + player.getDeckString() + '] - ' +
                JSON.stringify(player.special_counts));
      writeText('>>    ' + JSON.stringify(player.card_counts));
    }
  }
}

function storeLog() {
  if (!debug_mode) {
    localStorage["log"] = $('#full_log').html();
  }
}

function hideExtension() {
  deck_spot.innerHTML = "exit";
  points_spot.innerHTML = "faq";
  $('#log').show();
  $('#full_log').hide();
}

function delayedRunCommand(command) {
  var time = new Date().getTime();
  var command = command + "(" + time + ")";
  var wait_time = 200 * Math.floor(Math.random() * 10 + 1);
  // If we introduced the extension, we get first dibs on answering.
  if (i_introduced) wait_time = 100;
  setTimeout(command, wait_time);
}

function handleChatText(speaker, text) {
  if (!text) return;
  if (disabled) return;

  if (text == " !status") delayedRunCommand("maybeShowStatus");
  if (text == " !details") delayedRunCommand("maybeShowDetails");

  if (getOption("allow_disable") && text == " !disable" && turn_number <= 5) {
    localStorage.setItem("disabled", "t");
    disabled = true;
    hideExtension();
    writeText(">> Point counter disabled.");
  }

  if (text.indexOf(" >> ") == 0) {
    last_status_print = new Date().getTime();
  }
  if (!introduced && text.indexOf(" ★ ") == 0) {
    introduced = true;
    if (speaker == localStorage["name"]) {
      i_introduced = true;
    }
  }
}

function addSetting(setting, output) {
  if (localStorage[setting] != undefined) {
    output[setting] = localStorage[setting];
  }
}
function settingsString() {
  var settings = new Object();
  addSetting("debug", settings);
  addSetting("always_display", settings);
  addSetting("allow_disable", settings);
  addSetting("name", settings);
  addSetting("show_card_counts", settings);
  addSetting("status_announce", settings);
  addSetting("status_msg", settings);
  return JSON.stringify(settings);
}

function handleGameEnd(doc) {
  for (var node in doc.childNodes) {
    if (doc.childNodes[node].innerText == "game log") {
      // Reset exit / faq at end of game.
      started = false;
      hideExtension();

      localStorage.removeItem("log");

      // Collect information about the game.
      var href = doc.childNodes[node].href;
      var game_id_str = href.substring(href.lastIndexOf("/") + 1);
      var name = localStorage["name"];
      if (name == undefined || name == null) name = "Unknown";

      // Double check the scores so we can log if there was a bug.
      var has_correct_score = true;
      var win_log = $('div.logline.em').prev()[0];
      if (!announced_error && win_log) {
        var summary = win_log.innerText;
        for (player in players) {
          var player_name = players[player].name;
          if (player_name == "You") {
            player_name = rewriteName(name);
          }
          var re = new RegExp(RegExp.quote(player_name) + " has (-?[0-9]+) points");
          var arr = summary.match(re);
          if (arr && arr.length == 2) {
            var score = ("" + players[player].getScore()).replace(/^.*=/, "");
            if (score.indexOf("+") != -1) {
              score = ("" + players[player].getScore()).replace(/^([0-9]+)\+.*/, "$1");
            }
            if (has_correct_score && arr[1] != score) {
              has_correct_score = false;
              break;
            }
          }
        }
      }

      // Don't bother logging correct score games.
      if (has_correct_score) return;

      var printed_state_strings = stateStrings();

      // Post the game information to app-engine for later use for tests, etc.
      chrome.extension.sendRequest({
        type: "log",
        game_id: game_id_str,
        reporter: name,
        correct_score: has_correct_score,
        state_strings: printed_state_strings,
        log: document.body.innerHTML,
        version: extension_version,
        settings: settingsString() });
      break;
    }
  }
}

function maybeStartOfGame(node) {
  var nodeText = node.innerText.trim();
  if (nodeText.length == 0) {
    return;
  }

  if (localStorage.getItem("log") == undefined &&
      nodeText.indexOf("Your turn 1 —") != -1) {
    // We don't have a log but it's turn 1. This must be a solitaire game.
    // Create a fake (and invisible) setup line. We'll get called back again
    // with it.
    console.log("Single player game.");
    node = $('<div class="logline" style="display:none;">' +
        'Turn order is you.</div>)').insertBefore(node)[0];
    return;
  }

  // The first line of actual text is either "Turn order" or something in
  // the middle of the game.
  if (nodeText.indexOf("Turn order") == 0) {
    // The game is starting, so put in the initial blank entries and clear
    // out any local storage.
    console.log("--- starting game ---");
    localStorage.removeItem("log");
    localStorage.removeItem("disabled");
    createFullLog();
  } else {
    console.log("--- replaying history ---");
    disabled = localStorage.getItem("disabled") == "t";
    if (!restoreHistory(node)) return;
  }
  started = true;
}

// Returns true if the log node should be handled as part of the game.
function logEntryForGame(node) {
  if (inLobby()) {
    // Remove the log if we have one as we're not in a game.
    if (localStorage.getItem("log") != undefined) {
      localStorage.removeItem("log");
    }
    return false;
  }

  if (!started) {
    maybeStartOfGame(node);
  }
  return started;
}

function restoreHistory(node) {
  // The first log line is not the first line of the game, so restore the
  // log from history. Of course, there must be a log history to restore.
  var logHistory = localStorage.getItem("log");
  if (logHistory == undefined || logHistory.length == 0) {
    return false;
  }

  createFullLog();
  restoring_log = true;

  // First build a DOM tree of the old log messages in a copy of the log.
  var log_entries = $('<pre id="temp"></pre>').html(logHistory).children();
  for (var i = 0; i < log_entries.length; ++i) {
    var entry = $(log_entries[i]);
    if (entry.text() == node.innerText) break;
    $('#full_log').append(entry.clone());
    handleLogEntry(entry[0]);
  }
  restoring_log = false;
  return true;
}

function inLobby() {
  return $('#lobby').length != 0 && $('#lobby').css('display') != "none";
}

function handle(doc) {
  // When the lobby screen is built, make sure point tracker settings are used.
  if (doc.className && doc.className == "constr") {
    $('#tracker').attr('checked', true).attr('disabled', true);
    $('#autotracker').val('yes').attr('disabled', true);
  }

  try {
    if (doc.parentNode.id == 'log') {
      if (logEntryForGame(doc)) {
        handleLogEntry(doc);
        if (started) {
          storeLog();
        }
      }
    }

    if (doc.parentNode.id == "supply") {
      show_action_count = false;
      show_unique_count = false;
      show_duchy_count = false;
      show_victory_count = false;
      elems = doc.getElementsByTagName("span");
      for (var elem in elems) {
        if (elems[elem].innerText == "Vineyard") show_action_count = true;
        if (elems[elem].innerText == "Fairgrounds") show_unique_count = true;
        if (elems[elem].innerText == "Duke") show_duchy_count = true;
        if (elems[elem].innerText == "Silk Road") show_victory_count = true;
      }
    }

    if (!started) return;

    if (doc.constructor == HTMLDivElement && doc.parentNode.id == "choices") {
      handleGameEnd(doc);
      if (!started) return;
    }

    if (doc.parentNode.id == "chat" && doc.childNodes.length > 2) {
      handleChatText(doc.childNodes[1].innerText.slice(0, -1),
                     doc.childNodes[2].nodeValue);
    }

    if (getOption("always_display")) {
      if (!disabled) {
        updateScores();
        updateDeck();
      }
    }
  }
  catch (err) {
    console.log(err);
    console.log(doc);
    var error = '';
    if (doc.innerText != undefined) {
      error += "On '" + doc.innerText + "': ";
    }
    handleError("Javascript exception: " + err.stack);
  }
}


//
// Chat status handling.
//

function buildStatusMessage() {
  var status_message = "/me Auto▼Count";
  if (localStorage["status_msg"] != undefined &&
      localStorage["status_msg"] != "") {
    status_message = status_message + " - " + localStorage["status_msg"];
  }
  return status_message;
}

function enterLobby() {
  if (getOption("status_announce") &&
      $('#lobby').length != 0 && $('#lobby').css('display') != "none") {
    // Set the original status message.
    writeText(buildStatusMessage());

    // Handle updating status message as needed.
    $('#entry').css('display', 'none');
    $('#entry').after('<input id="fake_entry" class="entry" style="width: 350px;">');
    $('#fake_entry').keyup(function(event) {
      var value = $('#fake_entry').val();
      var re = new RegExp("^/me(?: (.*))?$");
      var arr = value.match(re);
      if (arr && arr.length == 2) {
        // This is a status message update.
        if (arr[1] != undefined) {
          localStorage["status_msg"] = arr[1];
        } else {
          localStorage.removeItem("status_msg");
        }
        value = buildStatusMessage();
      }
      $('#entry').val(value);

      if (event.which == 13) {
        getSayButton().click();
        $('#fake_entry').val("");
      }
    });

    getSayButton().addEventListener('click', function() {
      $('#fake_entry').val("");
    })
  }
}
setTimeout("enterLobby()", 600);

function maybeUpdateTempSay(ev) {
  // Show the temp say dialogues if needed.
  if (ev.relatedNode && ev.relatedNode.id == 'temp_say') {
    var node = $(ev.relatedNode).clone();
    node.attr('id', 'copied_temp_say');
    node.css('color', '#36f');
    node.css('font-style', 'italic');
    node.css('margin-left', '50px');
    $('#copied_temp_say').remove();
    $('#full_log').append(node);
    return;
  }

  // Copy the new html text. If it gets blanked out we don't get an event.
  var temp_say = $('#temp_say');
  if (temp_say.length > 0) {
    $('#copied_temp_say').html(temp_say.html());
  }
}

document.body.addEventListener('DOMNodeInserted', function(ev) {
  maybeUpdateTempSay(ev);
  handle(ev.target);
});

chrome.extension.sendRequest({ type: "version" }, function(response) {
  extension_version = response;
});
