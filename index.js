var fs = require('fs');
var TableEditor = require('table-editor');
var prettify = require('jsonpretty');
var elClass = require('element-class');
var levelup = require('levelup');
var leveljs = require('level-js');
var on = require('component-delegate').bind;
var closest = require('component-closest');
var CSV = require('comma-separated-values');

/* get the table template */
var template = fs.readFileSync('./templates/table.html', 'utf8');

/* create the table editor */
window.editor = new TableEditor({
  el: 'main-content',
  template: template
});

/* get the help message */
var hello = document.getElementById('hello-message');

/* created the db */
window.db = levelup('sheet', { db: leveljs, valueEncoding: 'json' });

/* check to see if the sheet has has been added to the db already */
db.get('sheet', function (err, value) {
  if (err && err.type === "NotFoundError") editor.clear();
  else if (value.columns && value.columns.length > 0) {
    elClass(hello).add('hidden');
    editor.set(value);
  }
  else editor.clear();
});

/* listen for changes to the data and save the object to the db */
editor.on('change', function (change, data) {
  db.put('sheet', editor.data, function (error) {
    if (error) console.error(error);
  });
});

/* listener for adding a row */
on(document.body, '#add-row', 'click', function (e) {
  editor.addRow();
});

/* listener for adding a column */
on(document.body, '#add-column', 'click', function (e) {
  if (editor.get('columns')) elClass(hello).add('hidden');
  var name = window.prompt('New column name');
  if (name) editor.addColumn({ name: name, type: 'string' });
});

/* get elements for codebox and its textarea */
var codeBox = document.getElementById('code-box');
var textarea = codeBox.querySelector('textarea');

/* listener for showing the data as json */
on(document.body, '#show-json', 'click', function (e) {
  textarea.value = prettify(editor.getRows());
  elClass(codeBox).remove('hidden');
});

/* listener for showing the data as csv */
on(document.body, '#show-csv', 'click', function (e) {
  textarea.value = new CSV(editor.getRows(), { header: true }).encode();
  elClass(codeBox).remove('hidden');
});

/* listener for closing the codebox */
on(document.body, '#close', 'click', function (e) {
  textarea.value = '';
  elClass(codeBox).add('hidden');
});

/* listener for clearing the db */
on(document.body, '#reset', 'click', function (e) {
  var msg = 'Are you sure you want to reset this project? You will start over with an empty workspace.';
  if (window.confirm(msg)) {
    editor.clear();
    elClass(hello).remove('hidden');
  };
});

/* listener for the delete column button */
on(document.body, 'thead .destroy', 'click', function (e) {
  var id;

  if (elClass(e.target).has('destroy')) id = e.target.id;
  else if (elClass(e.target).has('destroy-icon')) id = closest(e.target, '.destroy').id;

  if (window.confirm('Sure you want to delete this column and its contents?')) {
    editor.destroyColumn(id);
  }
});

on(document.body, '.delete-row', 'click', function (e) {
  var btn;
  console.log('waaaaa')
  if (elClass(e.target).has('delete-row')) btn = e.target;
  else if (elClass(e.target).has('destroy-icon')) btn = closest(e.target, '.delete-row');
  var row = closest(btn, 'tr');
  console.log(row.id, row)
  if (window.confirm('Sure you want to delete this row and its contents?')) {
    editor.destroyRow(row.id);
  }
});


/* listener for the table body */
on(document.body, '#table-body', 'click', function (e) {
  var btn;

  if (e.target.tagName === 'TEXTAREA') {
    var cellEl = document.getElementById(closest(e.target, 'td').id);

    var id = closest(e.target, 'td').id;

    e.target.onblur = function (e) {
    }

    return;
  }


});
