/*
 * Contentediable Mentiony jQuery plugin
 * Version 0.1.0
 * Written by: Luat Nguyen(luatnd) on 2016/05/27
 *
 * Transform textarea or input into contentediable with mention feature.
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */
var tmpEle = null;

(function ($) {
  var KEY = {
    AT: 64,
    BACKSPACE: 8,
    DELETE: 46,
    TAB: 9,
    ESC: 27,
    RETURN: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    HOME: 36,
    END: 35,
    COMMA: 188,
    NUMPAD_ADD: 107,
    NUMPAD_DECIMAL: 110,
    NUMPAD_DIVIDE: 111,
    NUMPAD_ENTER: 108,
    NUMPAD_MULTIPLY: 106,
    NUMPAD_SUBTRACT: 109,
    PAGE_DOWN: 34,
    PAGE_UP: 33,
    PERIOD: 190,
  };

  jQuery.fn.mentiony = function (method, options) {
    var defaults = {
      debug: 0, // Set 1 to see console log message of this plugin

      /**
       * True [default] will make mention area size equal to initial size of textarea. NOTE: Textarea must visible on document ready if this value is true.
       * False will not specify the CSS width attribute to every mention area.
       */
      applyInitialSize: true,

      globalTimeout: null, // Don't overwrite this config
      timeOut: 400, // Do mention only when user input idle time > this value
      triggerChar: '@', // @keyword-to-mention

      /**
       * Function for mention data processing
       * @param mode
       * @param keyword
       * @param onDataRequestCompleteCallback
       */
      onDataRequest: function (mode, keyword, onDataRequestCompleteCallback) {

      },

      /**
       * Addition keyboard event handle for old and new input
       * Why we need this:
       *  • Because some original js was binded to textarea, we need to bind it to contenteditable too.
       *  • Useful when you wanna passing some event trigger of old element to new editable content
       *  • Old input element already be trigger some event, then you need to pass some needed event to new editable element
       * @param event
       * @param oldInputEle
       * @param newEditableEle
       */
      onKeyPress: function (event, oldInputEle, newEditableEle) {
        oldInputEle.trigger(event);
      },
      onKeyUp: function (event, oldInputEle, newEditableEle) {
        oldInputEle.trigger(event);
      },
      onBlur: function (event, oldInputEle, newEditableEle) {
        oldInputEle.trigger(event);
      },
      onPaste: function (event, oldInputEle, newEditableEle) {
        oldInputEle.trigger(event);
      },
      onInput: function (oldInputEle, newEditableEle) {

      },

      // adjust popover relative position with its parent.
      popoverOffset: {
        x: -30,
        y: 0
      },

      templates: {
        container: '<div id="mentiony-container-[ID]" class="mentiony-container"></div>',
        content: '<div id="mentiony-content-[ID]" class="mentiony-content" contenteditable="true"></div>',
        popover: '<div id="mentiony-popover-[ID]" class="mentiony-popover"></div>',
        list: '<ul id="mentiony-popover-[ID]" class="mentiony-list"></ul>',
        listItem: '<li class="mentiony-item" data-item-id="">' +
          '<div class="row">' +
          '<div class="col-xs-3 col-sm-3 col-md-3 col-lg-3">' +
          '<img src="https://avatars2.githubusercontent.com/u/1859127?v=3&s=140">' +
          '</div>' +
          '<div class="pl0 col-xs-9 col-sm-9 col-md-9 col-lg-9">' +
          '<p class="title">Company name</p>' +
          '<p class="help-block">Addition information</p>' +
          '</div>' +
          '</div>' +
          '</li>',
        normalText: '<span class="normal-text">&nbsp;</span>',
        highlight: '<span class="highlight"></span>',
        highlightContent: '<a href="[HREF]" data-item-id="[ITEM_ID]" class="mentiony-link">[TEXT]</a>',
      }
    };

    if (typeof method === 'object' || !method) {
      options = method;
    }

    var settings = $.extend({}, defaults, options);

    return this.each(function () {
      var instance = $.data(this, 'mentiony') || $.data(this, 'mentiony', new MentionsInput(settings));

      if (typeof instance[method] === 'function') {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));
      } else if (typeof method === 'object' || !method) {
        return instance.init.call(this, this);
      } else {
        $.error('Method ' + method + ' does not exist');
      }
    });
  };

  var MentionsInput = function (settings) {
    var elmInputBoxContainer, elmInputBoxContent, elmInputBox,
      elmInputBoxInitialWidth, elmInputBoxInitialHeight,
      editableContentLineHeightPx,
      popoverEle, list, elmInputBoxId,
      elmInputBoxContentAbsPosition = {top: 0, left: 0},
      dropDownShowing = false,
      events = {
        keyDown: false,
        keyPress: false,
        input: false,
        keyup: false,
      },
      currentMention = {
        keyword: '',
        jqueryDomNode: null, // represent jQuery dom data
        mentionItemDataSet: [], // list item json data was store here
        lastActiveNode: 0,
        charAtFound: false, // tracking @ char appear or not
      }
    ;
    var needMention = false; // Mention state
    var inputId = Math.random().toString(36).substr(2, 6); // generate 6 character rand string

    var onDataRequestCompleteCallback = function (responseData) {
      populateDropdown(currentMention.keyword, responseData);
    };

    function initTextArea(ele) {
      elmInputBox = $(ele);

      if (elmInputBox.attr('data-mentions-input') == 'true') {
        return;
      } else {
        elmInputBox.attr('data-mentions-input', 'true');

        if (elmInputBox.attr('id').length == 0) {
          elmInputBoxId = 'mentiony-input-' + inputId;
          elmInputBox.attr('id', elmInputBoxId);
        } else {
          elmInputBoxId = elmInputBox.attr('id');
        }
      }


      // Initial UI information
      elmInputBoxInitialWidth = elmInputBox.prop('scrollWidth');
      elmInputBoxInitialHeight = elmInputBox.prop('scrollHeight');

      // Container
      elmInputBoxContainer = $(settings.templates.container.replace('[ID]', inputId));
      elmInputBoxContent = $(settings.templates.content.replace('[ID]', inputId));

      // Make UI and hide the textarea
      var placeholderText = elmInputBox.attr('placeholder');
      if (typeof placeholderText === 'undefined') {
        placeholderText = elmInputBox.text();
      }
      elmInputBoxContent.attr('data-placeholder', placeholderText);

      elmInputBoxContainer.append(elmInputBox.clone().addClass('mention-input-hidden'));
      elmInputBoxContainer.append(elmInputBoxContent);
      elmInputBox.replaceWith(elmInputBoxContainer);

      popoverEle = $(settings.templates.popover.replace('[ID]', inputId));
      list = $(settings.templates.list.replace('[ID]', inputId));
      elmInputBoxContainer.append(popoverEle);
      popoverEle.append(list);

      // Reset the input
      elmInputBox = $('#' + elmInputBoxId);

      // Update initial UI
      var containerPadding = parseInt(elmInputBoxContainer.css('padding'));

      if (settings.applyInitialSize) {
        elmInputBoxContainer.addClass('initial-size');
        elmInputBoxContainer.css({width: (elmInputBoxInitialWidth) + 'px'});
        elmInputBoxContent.width((elmInputBoxInitialWidth - 2 * containerPadding) + 'px');
      } else {
        elmInputBoxContainer.addClass('auto-size');
      }

      elmInputBoxContent.css({minHeight: elmInputBoxInitialHeight + 'px'});

      elmInputBoxContentAbsPosition = elmInputBoxContent.offset();
      editableContentLineHeightPx = parseInt($(elmInputBoxContent.css('line-height')).selector);

      // This event occured from top to down.
      // When press a key: onInputBoxKeyDown --> onInputBoxKeyPress --> onInputBoxInput --> onInputBoxKeyUp
      elmInputBoxContent.bind('keydown', onInputBoxKeyDown);
      elmInputBoxContent.bind('keypress', onInputBoxKeyPress);
      elmInputBoxContent.bind('input', onInputBoxInput);
      elmInputBoxContent.bind('keyup', onInputBoxKeyUp);
      elmInputBoxContent.bind('click', onInputBoxClick);
      elmInputBoxContent.bind('blur', onInputBoxBlur);
      elmInputBoxContent.bind('paste', onInputBoxPaste);
    }

    /**
     * Put all special key handle here
     * @param e
     */
    function onInputBoxKeyDown(e) {
      // log('onInputBoxKeyDown');

      // reset events tracking
      events = {
        keyDown: true,
        keyPress: false,
        input: false,
        keyup: false,
      };


      if (dropDownShowing) {
        return handleUserChooseOption(e);
      }
    }

    /**
     * Character was entered was handled here
     * This event occur when a printable was pressed. Or combined multi key was handle here, up/down can not read combined key
     * NOTE: Delete key is not be triggered here
     * @param e
     */
    function onInputBoxKeyPress(e) {
      // log('onInputBoxKeyPress');
      events.keyPress = true;

      if (!needMention) {
        // Try to check if need mention
        needMention = (e.keyCode === KEY.AT || e.which === KEY.AT);
        // log(needMention, 'needMention', 'info');
      }

      // force focus on element so it triggers on IE
      content.click();

      settings.onKeyPress.call(this, e, elmInputBox, elmInputBoxContent);
    }


    /**
     * When input value was change, with any key effect the input value
     * Delete was trigger here
     */
    function onInputBoxInput(e) {
      // log('onInputBoxInput');
      events.input = true;

      // convert android character to codes so it could be matched
      var converted = e.originalEvent.data.charCodeAt(0);

      // trigger mentiony on mobile devices
      if (!needMention) {
        needMention = ((e.keyCode === KEY.AT || e.which === KEY.AT) || (converted === KEY.AT));
      }

      // force focus on element so it triggers on IE
      content.click();

      settings.onInput.call(this, elmInputBox, elmInputBoxContent);
    }

    /**
     * Put all special key handle here
     * @param e
     */
    function onInputBoxKeyUp(e) {
      // log('onInputBoxKeyUp');
      events.keyup = true;
      // log(events, 'events');

      if (events.input) {
        updateDataInputData(e);
      }

      if (needMention) {
        // Update mention keyword only inputing(not enter), left, right
        if ((e.keyCode !== KEY.RETURN || e.which === KEY.RETURN) && (events.input || (e.keyCode === KEY.LEFT || e.which === KEY.LEFT) || (e.keyCode === KEY.RIGHT || e.which === KEY.RIGHT))) {
          updateMentionKeyword(e);
          doSearchAndShow();
        }
      }

      settings.onKeyUp.call(this, e, elmInputBox, elmInputBoxContent);
    }

    function onInputBoxClick(e) {
      // log('onInputBoxClick');

      if (needMention) {
        updateMentionKeyword(e);
        doSearchAndShow();
      }
    }

    function onInputBoxBlur(e) {
      // log('onInputBoxBlur');

      settings.onBlur.call(this, e, elmInputBox, elmInputBoxContent);
    }

    function onInputBoxPaste(e) {
      // log('onInputBoxPaste');

      settings.onPaste.call(this, e, elmInputBox, elmInputBoxContent);
    }

    function onListItemClick(e) {
      //$(this) is the clicked listItem
      setSelectedMention($(this));
      choseMentionOptions(true);
    }


    /**
     * Save content to original textarea element, using for form submit to server-side
     * @param e
     */
    function updateDataInputData(e) {
      var elmInputBoxText = elmInputBoxContent.html();
      elmInputBox.val(convertSpace(elmInputBoxText));
      log(elmInputBox.val(), 'elmInputBoxText : ');
      tmpEle = elmInputBox;
    }

    /**
     * Trim space and &nbsp; from string
     * @param text
     * @returns {*|void|string|XML}
     */
    function trimSpace(text) {
      return text.replace(/^(&nbsp;|&nbsp|\s)+|(&nbsp;|&nbsp|\s)+$/g, '');
    }

    /**
     * Convert &nbsp; to space
     * @param text
     * @returns {*|void|string|XML}
     */
    function convertSpace(text) {
      return text.replace(/(&nbsp;)+/g, ' ');
    }

    /**
     * Handle User search action with timeout, and show mention if needed
     */
    function doSearchAndShow() {

      if (settings.timeOut > 0) {
        if (settings.globalTimeout !== null) {
          clearTimeout(settings.globalTimeout);
        }
        settings.globalTimeout = setTimeout(function () {
          settings.globalTimeout = null;

          settings.onDataRequest.call(this, 'search', currentMention.keyword, onDataRequestCompleteCallback);

        }, settings.timeOut);

      } else {
        settings.onDataRequest.call(this, 'search', currentMention.keyword, onDataRequestCompleteCallback);
      }
    }

    /**
     * Build and handle dropdown popover content show/hide
     * @param keyword
     * @param responseData
     */
    function populateDropdown(keyword, responseData) {
      list.empty();
      currentMention.jqueryDomNode = null;
      currentMention.mentionItemDataSet = responseData;

      if (responseData.length) {
        if (currentMention.charAtFound === true) {
          showDropDown();
        }

        responseData.forEach(function (item, index) {
          var listItem = $(settings.templates.listItem);
          listItem.attr('data-item-id', item.id);
          listItem.find('img:first').attr('src', item.avatar);
          listItem.find('p.title:first').html(item.name);
          listItem.find('p.help-block:first').html(item.info);
          listItem.bind('click', onListItemClick);
          list.append(listItem);
        });

      } else {
        hideDropDown();
      }
    }

    /**
     * Show popover box contain result item
     */
    function showDropDown() {
      var curAbsPos = getSelectionCoords();
      dropDownShowing = true;
      popoverEle.css({
        display: 'block',
        top: curAbsPos.y - (elmInputBoxContentAbsPosition.top - $(document).scrollTop()) + (editableContentLineHeightPx + 10),
        left: curAbsPos.x - elmInputBoxContentAbsPosition.left
      });
    }

    function hideDropDown() {
      dropDownShowing = false;
      popoverEle.css({display: 'none'});
    }


    /**
     * Handle the event when user choosing / chose.
     * @param e
     * @returns {boolean} Continue to run the rest of code or not. If choosing metion or choosed mention, will stop doing anything else.
     */
    function handleUserChooseOption(e) {
      if (!dropDownShowing) {
        return true;
      }

      if ((e.keyCode === KEY.UP || e.which === KEY.UP) || (e.keyCode === KEY.DOWN || e.which === KEY.DOWN)) {
        choosingMentionOptions(e);
        return false;
      }

      // Try to exit mention state: Stop mention if @, Home, Enter, Tabs
      if (((e.keyCode === KEY.HOME || e.which === KEY.HOME))
        || ((e.keyCode === KEY.RETURN || e.which === KEY.RETURN))
        || ((e.keyCode === KEY.TAB || e.which === KEY.TAB))
      ) {
        choseMentionOptions();
        return false;
      }

      return true;
    }

    /**
     * Update mention keyword on: Input / LEFT-RIGHT
     */
    function updateMentionKeyword(e) {
      if (document.selection) {
        // var node = document.selection.createRange().parentElement(); // IE
        var node = document.selection.createRange(); // IE
        // TODO: Test on IE
      } else {
        // var node = window.getSelection().anchorNode.parentNode; // everyone else
        var node = window.getSelection().anchorNode; // everyone else
      }

      var textNodeData = node.data;
      if (typeof textNodeData === 'undefined') {
        textNodeData = '';
      }
      var cursorPosition = getSelectionEndPositionInCurrentLine(); // passing the js DOM ele

      // Save current position for mouse click handling, because when you use mouse, no selection was found.
      currentMention.lastActiveNode = node;

      // reset and set new mention keyword
      currentMention.keyword = '';

      var i = cursorPosition - 1; // NOTE: cursorPosition is Non-zero base
      var next = true;
      while (next) {
        var charAt = textNodeData.charAt(i);
        if (charAt === '' || charAt === settings.triggerChar) {
          next = false;
        }
        i--;
      }

      currentMention.keyword = textNodeData.substring(i + 1, cursorPosition);
      if (currentMention.keyword.indexOf(settings.triggerChar) === -1) {
        currentMention.keyword = '';
        currentMention.charAtFound = false;

        // NOTE: Still need mention but turn off dropdown now
        hideDropDown();
      } else {
        currentMention.keyword = currentMention.keyword.substring(1, cursorPosition);
        currentMention.charAtFound = true;
      }

      log(currentMention.keyword, 'currentMention.keyword');
    }

    function getMentionKeyword() {
      return currentMention.keyword;
    }

    /**
     * Update UI, show the selected item
     * @param item Jquery object represent the list-item
     */
    function setSelectedMention(item) {
      currentMention.jqueryDomNode = item;
      updateSelectedMentionUI(item);

      log(item, 'setSelectedMention item: ');
    }

    function updateSelectedMentionUI(selectedMentionItem) {
      $.each(list.children(), function (i, listItem) {
        $(listItem).removeClass('active');
      });
      selectedMentionItem.addClass('active');
    }

    /**
     * Handle when user use keyboard to choose mention
     * @param e
     */
    function choosingMentionOptions(e) {
      log('choosingMentionOptions');

      // Get Selected mention Item
      if (currentMention.jqueryDomNode === null) {
        setSelectedMention(list.children().first());
      }

      var item = [];

      if (e.keyCode === KEY.DOWN || e.which === KEY.DOWN) {
        item = currentMention.jqueryDomNode.next();
      } else if (e.keyCode === KEY.UP || e.which === KEY.UP) {
        item = currentMention.jqueryDomNode.prev();
      }

      if (item.length === 0) {
        item = currentMention.jqueryDomNode;
      }

      setSelectedMention(item);
    }

    /**
     * Handle UI and data when user chose an mention option.
     */
    function choseMentionOptions(chooseByMouse) {
      if (chooseByMouse === 'undefined') {
        chooseByMouse = false;
      }
      log('choosedMentionOptions by ' + (chooseByMouse ? 'Mouse' : 'Keyboard'));

      var currentMentionItemData = {};

      var selectedId = currentMention.jqueryDomNode.attr('data-item-id');
      for (var i = 0, len = currentMention.mentionItemDataSet.length; i < len; i++) {
        if (selectedId == currentMention.mentionItemDataSet[i].id) {
          currentMentionItemData = currentMention.mentionItemDataSet[i];
          break;
        }
      }

      var highlightNode = $(settings.templates.highlight);
      var highlightContentNode = $(settings.templates.highlightContent
        .replace('[HREF]', currentMentionItemData.href)
        .replace('[TEXT]', currentMentionItemData.name)
        .replace('[ITEM_ID]', currentMentionItemData.id)
      );
      highlightNode.append(highlightContentNode);
      replaceTextInRange('@' + currentMention.keyword, highlightNode.prop('outerHTML'), chooseByMouse);


      // Finish mention
      log('Finish mention', '', 'warn');

      needMention = false; // Reset mention state
      currentMention.keyword = ''; // reset current Data if start with @

      hideDropDown();
      updateDataInputData();
    }

    function log(msg, prefix, level) {
      if (typeof level === 'undefined') {
        level = 'log';
      }
      if (settings.debug === 1) {
        eval("console." + level + "(inputId, prefix ? prefix + ':' : '', msg);");
      }
    }

    /**
     * Intend to replace current @key-word with mention structured HTML
     * NOTE: depend on jQuery
     * @param fromString
     * @param toTextHtml
     * @param choosedByMouse
     */
    function replaceTextInRange(fromString, toTextHtml, choosedByMouse) {
      var positionInfo = {
        startBefore: 0,
        startAfter: 0,
        stopBefore: 0,
        stopAfter: 0,
      };

      var sel = window.getSelection();
      var range;


      // Move caret to current caret in case of contentediable is not active --> no caret

      if (choosedByMouse !== 'undefined' && choosedByMouse === true) {
        var lastActiveNode = currentMention.lastActiveNode;
        try {
          var offset = lastActiveNode.data.length;
        } catch (e) {
          log(e, 'lastActiveNode Error:');
          var offset = 0;
        }

        range = document.createRange();
        range.setStart(lastActiveNode, offset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        // TODO: Bug: Choose mention by mouse: @123456: IF user put caret between 2 & 3 THEN the highlight will replace only 3456
      }

      var isIE = false;

      var stopPos = sel.focusOffset;
      var startPos = stopPos - fromString.length;

      if (window.getSelection) {
        isIE = false;
        sel = window.getSelection();
        if (sel.rangeCount > 0) {
          range = sel.getRangeAt(0).cloneRange();
          range.collapse(true);
        }
      } else if ((sel = document.selection) && sel.type != "Control") {
        range = sel.createRange();
        isIE = true;
      }

      if (startPos !== stopPos) {
        // replace / Remove content
        range.setStart(sel.anchorNode, startPos);
        range.setEnd(sel.anchorNode, stopPos);
        range.deleteContents();
      }

      // insert
      var node = document.createElement('span');
      node.setAttribute('class', 'mention-area');
      node.innerHTML = toTextHtml;
      range.insertNode(node);
      range.setEnd(sel.focusNode, range.endContainer.length);

      positionInfo.startBefore = startPos;
      positionInfo.stopBefore = stopPos;
      positionInfo.startAfter = startPos;
      positionInfo.stopAfter = startPos + node.innerText.length;


      // move cursor to end of keyword after replace
      var stop = false;
      node = $(sel.anchorNode);
      while (!stop) {
        if (node.next().text().length === 0) {
          stop = true;
        } else {
          node = node.next();
        }
      }

      // insert <newElem> after list
      var newElem = $(settings.templates.normalText).insertAfter(node);

      // move caret to after <newElem>
      range = document.createRange();
      range.setStartAfter(newElem.get(0));
      range.setEndAfter(newElem.get(0));
      sel.removeAllRanges();
      sel.addRange(range);

      return positionInfo;
    }


    // Public methods
    return {
      init: function (domTarget) {
        initTextArea(domTarget);
      },
    };
  };


  /**
   * Get current caret / selection absolute position (relative to viewport , not to parent)
   * Thank to Tim Down: http://stackoverflow.com/questions/6846230/coordinates-of-selected-text-in-browser-page
   * NOTE: This is relative to viewport, not its parent
   * @param win
   * @returns {{x: number, y: number}}
   */
  function getSelectionCoords(win) {
    win = win || window;
    var doc = win.document;
    var sel = doc.selection, range, rects, rect;
    var x = 0, y = 0;
    if (sel) {
      if (sel.type != "Control") {
        range = sel.createRange();
        range.collapse(true);
        x = range.boundingLeft;
        y = range.boundingTop;
      }
    } else if (win.getSelection) {
      sel = win.getSelection();
      if (sel.rangeCount) {
        range = sel.getRangeAt(0).cloneRange();

        if (range.getClientRects) {
          range.collapse(true);
          rects = range.getClientRects();
          if (rects.length > 0) {
            rect = rects[0];
          }
          x = rect.left;
          y = rect.top;
        }
        // Fall back to inserting a temporary element
        if (x == 0 && y == 0) {
          var span = doc.createElement("span");
          if (span.getClientRects) {
            // Ensure span has dimensions and position by
            // adding a zero-width space character
            span.appendChild(doc.createTextNode("\u200b"));
            range.insertNode(span);
            rect = span.getClientRects()[0];
            x = rect.left;
            y = rect.top;
            var spanParent = span.parentNode;
            spanParent.removeChild(span);

            // Glue any broken text nodes back together
            spanParent.normalize();
          }
        }
      }
    }
    return {x: x, y: y};
  }

  /**
   * Get current caret position in current line (not the current contenteditable)
   * @returns {number}
   */
  function getSelectionEndPositionInCurrentLine() {
    var selectionEndPos = 0;
    if (window.getSelection) {
      var sel = window.getSelection();
      selectionEndPos = sel.focusOffset;
    }

    return selectionEndPos;
  }

  // TODO: Add setting option: showMentionedItem :Filter mentioned item, we should not show a item if it already mentioned
  // TODO: Elastic search in case of local data (in case of ajax --> depend on server-side)
  // TODO: Use higlight
  // TODO: Dropdown: scroll to see more item WHEN user press DOWN and reach the end of list.
  // TODO: Change to A cross-browser JavaScript range and selection library.: https://github.com/timdown/rangy

}(jQuery));
