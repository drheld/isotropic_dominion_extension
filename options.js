var optionButtons = {
  allow_disable: {text: "Allow opponents to disable point counter with !disable."},
  status_announce: {text: "Change lobby status to announce you use point counter.",
                    extra: "Mandatory if disabling is not allowed."},
  always_display: {text: "Replace exit/faq with scores and card counts."},
  show_card_counts: {text: "Show every player's card counts for each card."},
};


function setOption(name, value) {
  localStorage[name] = value;
  $('#' + name).attr('checked', value);
}

function initializeOption(name, default_value) {
  var value = localStorage[name];

  // If it's not set, set it to the default.
  if (value == undefined) localStorage[name] = default_value;

  // Move forward deprecated options.
  if (value == 't') localStorage[name] = 'true';
  if (value == 'f') localStorage[name] = 'false';
}

function initializeOptions() {
  initializeOption('allow_disable', true);
  initializeOption('status_announce', false);
  initializeOption('always_display', true);
  initializeOption('show_card_counts', true);

  // Sanity check the options.
  if (!getOption('allow_disable') && !getOption('status_announce')) {
    alert('Allowing disabling.\n' +
          'If you do not want to allow disabling, please enable lobby status ' +
          'and turn off this setting.');
    setOption('status_announce', 'true');
  }
}

function onButtonChange(evt) {
  var button = $(evt.target);
  setOption(button.attr('id'), button.attr('checked'));
}

function createOptionButton(name, section, option) {
  var option_desc = option.text;
  if (option.extra) {
    option_desc += ' <span class="optionNote">(' + option.extra + ')</span>';
  }

  var control = $('<label/>').attr('for', name);
  var button = $('<input type="checkbox"/>').attr('id', name).attr('name', name);

  button.change(onButtonChange);
  control.append(button).append(option_desc);
  button.attr('checked', getOption(name));
  option.node = button;
  section.append(control);
}

function onDisableButtonChange() {
  var allow_disable = getOption('allow_disable');
  optionButtons['status_announce'].node.attr('disabled', allow_disable == false);
  if (!allow_disable) setOption('status_announce', true);
}

function buildOptionsSection() {
  initializeOptions();

  var section = $('<div/>').attr('id', 'optionPanel');
  section.append('<h3>Dominion Point Counter Options</h3>');

  for (var opt in optionButtons) {
    createOptionButton(opt, section, optionButtons[opt]);
  }

  // Make sure people are either disableable or show status message.
  var disable_button = optionButtons['allow_disable'].node;
  disable_button.change(function() { onDisableButtonChange(); });
  onDisableButtonChange();

  return section;
}

$(document).ready(function() {
  $(document.body).append(buildOptionsSection());

  localStorage.removeItem("log");
  localStorage.removeItem("disabled");
});
