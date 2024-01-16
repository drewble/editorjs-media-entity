let $ = require('jquery');
let Drupal = require('Drupal');
let ajax = require('@codexteam/ajax');

/**
 * Command to save the contents of an editor-provided modal.
 *
 * @param {Drupal.Ajax} ajax
 *   The Drupal.Ajax object.
 * @param {object} response
 *   The server response from the ajax request.
 * @param {number} status
 *   The status code from the ajax request.
 */
Drupal.AjaxCommands.prototype.editorJsDialogSave = function (ajax, response, status) {
  $(window).trigger('editorjs:mediadialogsave', [response.values]);
};

/**
 * Build styles
 */
require('./index.css').toString();

/**
 * MediaEntity Tool for the Editor.js
 * Works only with pasted image URLs and requires no server-side uploader.
 *
 * @typedef {object} MediaEntityData
 * @description Tool's input and output data format
 * @property {string} url — image URL
 * @property {string} caption — image caption
 * @property {string} file_uuid — The file uuid
 * @property {string} image_style — The image style
 * @property {string} view_mode — The view mode
 * @property {boolean} withBorder - should image be rendered with border
 * @property {boolean} withBackground - should image be rendered with
 *   background
 * @property {boolean} stretched - should image be stretched to full width of
 *   container
 */
class MediaEntity {
  /**
   * Render plugin`s main Element and fill it with saved data
   *
   * @param {{data: MediaEntityData, config: object, api: object}}
   *   data — previously saved data
   *   config - user config for Tool
   *   api - Editor.js API
   *   readOnly - read-only mode flag
   */
  constructor({ data, config, api, readOnly }) {
    /**
     * Editor.js API
     */
    this.api = api;
    this.readOnly = readOnly;
    this.config = config;
    this.once = false;
    /**
     * When block is only constructing,
     * current block points to previous block.
     * So real block index will be +1 after rendering
     *
     * @todo place it at the `rendered` event hook to get real block index
     *   without +1;
     * @type {number}
     */
    this.blockIndex = this.api.blocks.getCurrentBlockIndex() + 1;

    /**
     * Styles
     */
    this.CSS = {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,
      settingsButton: this.api.styles.settingsButton,
      settingsButtonActive: this.api.styles.settingsButtonActive,

      /**
       * Tool's classes
       */
      wrapper: 'cdx-media-image',
      imageHolder: 'cdx-media-image__picture',
      caption: 'cdx-media-image__caption',
    };

    /**
     * Nodes cache
     */
    this.nodes = {
      wrapper: null,
      imageHolder: null,
      image: null,
      caption: null,
    };

    /**
     * Tool's initial data
     */
    this.data = {
      url: data.url || '',
      uuid: data.uuid || '',
      file_uuid: data.file_uuid || '',
      image_style: data.image_style || '',
      view_mode: data.view_mode || config.view_mode || '',
      caption: data.caption || '',
      withBorder: data.withBorder !== undefined ? data.withBorder : false,
      withBackground: data.withBackground !== undefined ? data.withBackground : false,
      stretched: data.stretched !== undefined ? data.stretched : false,
      center: data.center !== undefined ? data.center : false,
    };

    /**
     * Available Image settings
     */
    this.settings = [
      {
        name: 'withBorder',
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.8 10.592v2.043h2.35v2.138H15.8v2.232h-2.25v-2.232h-2.4v-2.138h2.4v-2.28h2.25v.237h1.15-1.15zM1.9 8.455v-3.42c0-1.154.985-2.09 2.2-2.09h4.2v2.137H4.15v3.373H1.9zm0 2.137h2.25v3.325H8.3v2.138H4.1c-1.215 0-2.2-.936-2.2-2.09v-3.373zm15.05-2.137H14.7V5.082h-4.15V2.945h4.2c1.215 0 2.2.936 2.2 2.09v3.42z"/></svg>`,
      },
      {
        name: 'stretched',
        icon: `<svg width="17" height="10" viewBox="0 0 17 10" xmlns="http://www.w3.org/2000/svg"><path d="M13.568 5.925H4.056l1.703 1.703a1.125 1.125 0 0 1-1.59 1.591L.962 6.014A1.069 1.069 0 0 1 .588 4.26L4.38.469a1.069 1.069 0 0 1 1.512 1.511L4.084 3.787h9.606l-1.85-1.85a1.069 1.069 0 1 1 1.512-1.51l3.792 3.791a1.069 1.069 0 0 1-.475 1.788L13.514 9.16a1.125 1.125 0 0 1-1.59-1.591l1.644-1.644z"/></svg>`,
      },
      {
        name: 'withBackground',
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.043 8.265l3.183-3.183h-2.924L4.75 10.636v2.923l4.15-4.15v2.351l-2.158 2.159H8.9v2.137H4.7c-1.215 0-2.2-.936-2.2-2.09v-8.93c0-1.154.985-2.09 2.2-2.09h10.663l.033-.033.034.034c1.178.04 2.12.96 2.12 2.089v3.23H15.3V5.359l-2.906 2.906h-2.35zM7.951 5.082H4.75v3.201l3.201-3.2zm5.099 7.078v3.04h4.15v-3.04h-4.15zm-1.1-2.137h6.35c.635 0 1.15.489 1.15 1.092v5.13c0 .603-.515 1.092-1.15 1.092h-6.35c-.635 0-1.15-.489-1.15-1.092v-5.13c0-.603.515-1.092 1.15-1.092z"/></svg>`,
      },
      {
        name: 'center',
        icon: `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z" /></svg>`,
      }
    ];
  }

  static get toolbox() {
    return {
      title: 'Media',
      icon: '<svg width="18" height="18"  viewBox="0 0 24 24">\n' +
        '    <path fill="currentColor" d="M7,15L11.5,9L15,13.5L17.5,10.5L21,15M22,4H14L12,2H6A2,2 0 0,0 4,4V16A2,2 0 0,0 6,18H22A2,2 0 0,0 24,16V6A2,2 0 0,0 22,4M2,6H0V11H0V20A2,2 0 0,0 2,22H20V20H2V6Z" />\n' +
        '</svg>'
    };
  }

  /**
   * Creates a Block:
   *  1) Show preloader
   *  2) Start to load an image
   *  3) After loading, append image and caption input
   *
   * @public
   */
  render() {
    let ajaxDialog = Drupal.ajax({
      dialog: this.config.DrupalMediaLibrary_dialogOptions,
      dialogType: 'modal',
      selector: '.ckeditor-dialog-loading-link',
      url: this.config.DrupalMediaLibrary_url,
    });
    $(window).on('editorjs:mediadialogsave', (e, values) => {
      if (!this.nodes.image.src && values.hasOwnProperty('uuid') && values.hasOwnProperty('url')) {
        this.nodes.image.src = values['url'];
        this._data.uuid = values['uuid'];
        this._data.file_uuid = values['file_uuid'];
      }
    });

    const wrapper = this._make('div', [this.CSS.baseClass, this.CSS.wrapper]),
        loader = this._make('div', this.CSS.loading),
        imageHolder = this._make('div', this.CSS.imageHolder),
        image = this._make('img'),
        caption = this._make('div', [this.CSS.input, this.CSS.caption], {
          contentEditable: !this.readOnly,
          innerHTML: this.data.caption || '',
        });

    caption.dataset.placeholder = this.config.placeholder || this.api.i18n.t('Enter a caption');

    wrapper.appendChild(loader);
    if (this.data.url) {
      image.src = this.data.url;
    }
    else {
      ajaxDialog.execute();
    }

    image.onload = () => {
      wrapper.classList.remove(this.CSS.loading);
      imageHolder.appendChild(image);
      wrapper.appendChild(imageHolder);
      wrapper.appendChild(caption);
      loader.remove();
      this._acceptTuneView();
    };

    image.onerror = (e) => {
      // @todo use api.Notifies.show() to show error notification
      console.log('Failed to load an image', e);
    };

    this.nodes.imageHolder = imageHolder;
    this.nodes.wrapper = wrapper;
    this.nodes.image = image;
    this.nodes.caption = caption;

    return wrapper;
  }

  /**
   * @public
   * @param {Element} blockContent - Tool's wrapper
   * @returns {MediaEntityData}
   */
  save(blockContent) {
    const image = blockContent.querySelector('img'),
        caption = blockContent.querySelector('.' + this.CSS.input);

    if (!image) {
      return this.data;
    }

    return Object.assign(this.data, {
      url: image.src,
      caption: caption.innerHTML,
    });
  }

  /**
   * Sanitizer rules
   */
  static get sanitize() {
    return {
      url: {},
      withBorder: {},
      withBackground: {},
      stretched: {},
      caption: {
        br: true,
      },
    };
  }

  /**
   * Notify core that read-only mode is suppoorted
   *
   * @returns {boolean}
   */
  static get isReadOnlySupported() {
    return true;
  }

  /**
   * Returns image data
   *
   * @returns {MediaEntityData}
   */
  get data() {
    return this._data;
  }

  /**
   * Set image data and update the view
   *
   * @param {MediaEntityData} data
   */
  set data(data) {
    this._data = Object.assign({}, this.data, data);

    if (this.nodes.image) {
      this.nodes.image.src = this.data.url;
    }

    if (this.nodes.caption) {
      this.nodes.caption.innerHTML = this.data.caption;
    }
  }

  /**
   * Specify paste substitutes
   *
   * @see {@link ../../../docs/tools.md#paste-handling}
   * @public
   */
  static get pasteConfig() {
    return {
      patterns: {
        image: /https?:\/\/\S+\.(gif|jpe?g|tiff|png)$/i,
      },
      tags: [ 'img' ],
      files: {
        mimeTypes: [ 'image/*' ],
      },
    };
  }

  /**
   * Makes buttons with tunes: add background, add border, stretch image
   *
   * @returns {HTMLDivElement}
   */
  renderSettings() {
    const wrapper = document.createElement('div');

    this.settings.forEach(tune => {
      const el = document.createElement('div');

      el.classList.add(this.CSS.settingsButton);
      el.innerHTML = tune.icon;

      el.addEventListener('click', () => {
        this._toggleTune(tune.name);
        el.classList.toggle(this.CSS.settingsButtonActive);
      });

      el.classList.toggle(this.CSS.settingsButtonActive, this.data[tune.name]);

      wrapper.appendChild(el);
    });

    // Add button for choose image style.
    if (this.config.image_styles && Object.keys(this.config.image_styles).length && this.data.view_mode === '') {
      wrapper.appendChild(this.makeImageStyleTune());
    }

    return wrapper;
  };

  makeImageStyleTune() {
    const title = this.api.i18n.t('Choose image style');
    const el = this._make('div', [this.CSS.settingsButton], {
      innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24"> <path fill="currentColor" d="M22.7 14.3L21.7 15.3L19.7 13.3L20.7 12.3C20.8 12.2 20.9 12.1 21.1 12.1C21.2 12.1 21.4 12.2 21.5 12.3L22.8 13.6C22.9 13.8 22.9 14.1 22.7 14.3M13 19.9V22H15.1L21.2 15.9L19.2 13.9L13 19.9M21 5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H11V19.1L12.1 18H5L8.5 13.5L11 16.5L14.5 12L16.1 14.1L21 9.1V5Z" /></svg>',
      title,
    });
    el.addEventListener('click', () => {
      const imageStyleEl = el.parentElement.querySelector('.choose_image_style');
      if (!imageStyleEl) {
        this.makeImageSelect(el)
      }
      else {
        imageStyleEl.classList.toggle('showed', !imageStyleEl.classList.contains('showed'))
      }
    });

    el.dataset.tune = 'image_style';
    el.classList.toggle(this.CSS.settingsButtonActive, true);

    this.api.tooltip.onHover(el, title, {
      placement: 'top',
    });

    return el;
  }

  /**
   * Make select element for choose image style.
   *
   * @param {Element} tuneEl
   */
  makeImageSelect(tuneEl) {
    const select = this._make('div', ['choose_image_style', 'showed']);
    select.appendChild(this._make('div', 'label', {'innerHTML': 'Image styles'}));
    const list = this._make('div', 'list_styles');
    Object.keys(this.config.image_styles).map((id) => {
      let classes = ['style_id'];
      if (this.data.image_style === id) {
        classes.push('active');
      }
      let item = this._make('div', classes, {
        'innerHTML': this.config.image_styles[id],
      })
      item.dataset.value = id;
      list.appendChild(item)
    })
    select.appendChild(list);
    select.addEventListener('click', (e) => {
      if (e.target.classList.contains('style_id')) {
        this.setImageStyle(e.target.dataset.value)
        list.querySelector('.style_id.active').classList.toggle('active', false);
        e.target.classList.toggle('active', true);
      }
    })
    tuneEl.parentElement.appendChild(select);
  }

  /**
   * Setter image style value and set temp image url.
   *
   * @param {string} imageStyleId
   */
  setImageStyle(imageStyleId) {
    this._data.image_style = imageStyleId;
    let loader = this._make('div', this.CSS.loading);
    this.nodes.wrapper.appendChild(loader)
    this.nodes.image.style.display = 'none'
    let upload = ajax.post({
      url: this.config.endpoints.fetchStyleUrl,
      data: {
        'uuid': this._data.file_uuid,
        'image_style_id': this._data.image_style,
      },
      type: ajax.contentType.JSON,
      headers: {
        'X-CSRF-Token': this.config.endpoints.token
      },
    }).then(response => response.body);
    upload.then((response) => {
      this.nodes.image.src = response.url;
      loader.remove();
      this.nodes.image.style.display = 'inherit'
    }).catch((error) => {
      console.error(error);
    });
  }

  /**
   * Helper for making Elements with attributes
   *
   * @param  {string} tagName           - new Element tag name
   * @param  {Array|string} classNames  - list or name of CSS classname(s)
   * @param  {object} attributes        - any attributes
   * @returns {Element}
   */
  _make(tagName, classNames = null, attributes = {}) {
    const el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }

  /**
   * Click on the Settings Button
   *
   * @private
   * @param tune
   */
  _toggleTune(tune) {
    this.data[tune] = !this.data[tune];
    this._acceptTuneView();
  }

  /**
   * Add specified class corresponds with activated tunes
   *
   * @private
   */
  _acceptTuneView() {
    this.settings.forEach(tune => {
      this.nodes.imageHolder.classList.toggle(this.CSS.imageHolder + '--' + tune.name.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`), !!this.data[tune.name]);
    });
  }
}

module.exports = MediaEntity;
