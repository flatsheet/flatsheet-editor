var fs = require('fs');
var url = require('url');
var TableEditor = require('table-editor');
var elClass = require('element-class');
var on = require('component-delegate').bind;
var closest = require('component-closest');
var Handlebars = require('handlebars');
var request = require('xhr');
var domify = require('domify');
var dom = require('domquery');
var siblings = require('siblings');

module.exports = Editor;


/*

All options with default values:

var options = {
  socketio: false,
  
};

*/


function Editor (data, opts) {
  if (!(this instanceof Editor)) return new Editor(data, opts);
  opts || (opts = {});
  var self = this;
  
  this.createTemplates(opts.templates);
  this.createListeners();
  if (opts.socketio) this.useSocketIO();
  
  /* create the table editor */
  this.editor = new TableEditor({
    el: opts.el || 'main-content',
    template: this.templates.table,
    data: {
      name: opts.name,
      description: opts.description,
      publisher: opts.publisher
    }
  });
  
  this.editor.import(data);
  
  /* listen for changes to the data and save the object to the db */
  this.editor.on('change', function (change) {
    if (self.remoteChange) return;
    if (self.editor.data.rows) var rows = self.editor.getRows();
    if (!sorting && this.socketio) this.io.emit('change', change, rows);
  });
  
  var sorting;
  
  this.editor.on('dragstart', function () {
    sorting = true;
  });
  
  
  this.editor.on('drop', function () {
    var rows = self.editor.getRows();
    if (this.socketio) this.io.emit('change', {}, rows, sorting);
    sorting = false;
  });
}


Editor.prototype.createTemplates = function (opts) {
  opts || (opts = {});
  this.templates = {};

  this.templates.table = opts.table || fs.readFileSync(
    __dirname + '/templates/table.html', 'utf8'
  );
  
  this.templates.modal = opts.modal || Handlebars.compile(
    fs.readFileSync(__dirname + '/templates/modal.html', 'utf8')
  );   
  
  this.templates.userList = opts.userList || Handlebars.compile(
    fs.readFileSync(__dirname + '/templates/user-list.html', 'utf8')
  );
   
  this.templates.longText = opts.longText || Handlebars.compile(
    fs.readFileSync(__dirname + '/templates/long-text.html', 'utf8')
  ); 
};


Editor.prototype.createListeners = function () {
  var self = this;
  
  /* clear the data */
  on(document.body, '#destroy', 'click', function (e) {
    self.destroyData();
  });
  
  /* add a row */
  on(document.body, '#add-row', 'click', function (e) {
    self.addRow();
  });

  /* delete a row */
  on(document.body, '.delete-row', 'click', function (e) {
    self.destroyRow(e.target);
  });

  /* listener for the table body */
  on(document.body, '#table-editor textarea', 'click', function (e) {
    self.cellFocus(e);
  });

  /* listener for tabbing through cells */
  on(document.body, 'tbody', 'keyup', function (e) {
    if (elClass(e.target).has('cell') && e.keyCode === 9) {
      self.cellFocus(e);
    }
  });

  /* listener for expand-editor button */
  on(document.body, '.expand-editor', 'click', function (e) {
    e.preventDefault();
    self.cellFocus(e);
    self.openModalEditor(e.target);
  });

  /* listener for saving the long text editor */
  on(document.body, '#save-modal-editor', 'click', function (e) {
    self.saveModalEditor(e.target);
  });

  /* listener for closing a modal */
  on(document.body, '#close-modal', 'click', function (e) {
    self.closeModal();
  });

  /* listener for adding a column */
  on(document.body, '#add-column', 'click', function (e) {
    self.addColumn();
  });
};


Editor.prototype.useSocketIO = function () {
  this.socketio = true;
  var io = this.io = require('socket.io-client')();
  
  io.on('connect', function () {  
    io.emit('room', id);
    io.emit('user', user);
    var users = {};

    io.on('update-users', function (userlist) {
      usersEl.innerHTML = templates.userList({ users: userlist });
    });
  });

  io.on('change', function (change, rows, sort) {
    self.remoteChange = true;
    if (sort) self.editor.forceUpdate(rows);
    else self.editor.set(change);
    self.remoteChange = false;
  });

  io.on('cell-focus', function (id, color) {  
    var cell = document.querySelector('#' + id + ' textarea');
    if (cell) {
      cell.style.borderColor = color;
      cell.style.backgroundColor = '#fefefa';
    }
  });

  io.on('cell-blur', function (id) {  
    var cell = document.querySelector('#' + id + ' textarea');
    if (cell) {
      cell.style.borderColor = '#ccc';
      cell.style.backgroundColor = '#fff';
    }
  });

  io.on('disconnect', function () {});
};


Editor.prototype.cellFocus = function (e) {
  var self = this;
  
  var id = closest(e.target, 'td').id;
  if (this.socketio) this.io.emit('cell-focus', id, user.color);
  
  var row = closest(e.target, 'tr');
  row.setAttribute('draggable', false);

  e.target.onblur = function () {
    if (self.socketio) self.io.emit('cell-blur', id);
    row.setAttribute('draggable', true);
  };
}


Editor.prototype.startDownload = function (name, ext, content, type) {  
  if (!name || !ext || !content) return false;
  if (!type) type = extension;

  var body = document.body;
  var anchor_tag = document.createElement('a');
  var href = 'data:attachment/' + type + ',' + encodeURIComponent(content);

  anchor_tag.href = href;
  anchor_tag.target = '_blank';
  anchor_tag.download = name + '.' + ext;

  body.appendChild(anchor_tag);
  anchor_tag.click();
  body.removeChild(anchor_tag);
}


Editor.prototype.addColumn = function () {
  var name = window.prompt('New column name');
  if (name) this.editor.addColumn({ name: name, type: 'string' });
};


Editor.prototype.destroyColumn = function (target) {
  var id;

  if (elClass(target).has('destroy')) id = target.id;
  else if (elClass(target).has('destroy-icon')) id = closest(target, '.destroy').id;

  var msg = 'Sure you want to delete this column and its contents?';
  if (window.confirm(msg)) this.editor.destroyColumn(id);
  var data = this.editor.get('rows');
  this.editor.set('rows', data);
};


Editor.prototype.addRow = function () {
  this.editor.addRow();
};


Editor.prototype.destroyRow = function (target) {
  var btn;

  if (elClass(target).has('delete-row')) btn = target;
  else if (elClass(target).has('destroy-icon')) btn = closest(target, '.delete-row');

  var row = closest(btn, 'tr');
  var msg = 'Sure you want to delete this row and its contents?';

  if (window.confirm(msg)) {
    this.editor.destroyRow(row.id);
    this.editor.forceUpdate();
    this.editor.update();
  }
};


Editor.prototype.destroyData = function () {
  var msg = 'Are you sure you want to destroy the data in this project? You will start over with an empty workspace.';
  if (window.confirm(msg)) {
    this.editor.clear();
    elClass(hello).remove('hidden');
  };
}


Editor.prototype.openModal = function () {};


Editor.prototype.closeModal = function () {
  var id = document.querySelector('.expanded-cell-id').value;
  dom.remove('#modal');
  if (this.socketio) this.io.emit('cell-blur', id);
};


Editor.prototype.openModalEditor = function (target) {
  var id = closest(target, 'td').id;
  var link = closest(target, 'a');
  var cell = siblings(link, 'textarea')[0];
  var text = cell.value;

  var modal = this.templates.modal({
    content: this.templates.editLongText({ text: text, id: id })
  });

  dom.add(document.body, domify(modal));
};


Editor.prototype.saveModalEditor = function (target) {
  var expandedCell = siblings(target, 'textarea')[0];
  var id = siblings(target, 'input')[0].value;
  var cell = dom('#' + id + ' textarea');
  cell.value(expandedCell.value);
  dom.remove('#modal');
  this.editor.updateModel();
  if (this.socketio) this.io.emit('cell-blur', id);
}
