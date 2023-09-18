/* globals
ActiveEffect,
Dialog,
game,
readTextFromFile,
renderTemplate,
saveDataToFile,
ui
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { FLAGS, MODULE_ID } from "./const.js";
import { TerrainSettings } from "./settings.js";
import { EffectHelper } from "./EffectHelper.js";
import { TerrainEffectsApp } from "./TerrainEffectsApp.js";

/**
 * Subclass of Map that manages terrain ids and ensures only 1–31 are used.
 */
export class TerrainMap extends Map {
  /** @type {number} */
  MAX_TERRAINS = Math.pow(2, 5) - 1; // No 0 id.

  /** @type {number} */
  #nextId = 1;

  /** @override */
  set(id, terrain, override = false) {
    id ??= this.#nextId;

    if ( !override && this.has(id) ) {
      console.error("Id already present and override is false.");
      return;
    }

    if ( !Number.isInteger(id) || id < 1 ) {
      console.error(`Id ${id} is invalid.`);
      return;
    }

    if ( id > this.MAX_TERRAINS ) { console.warn(`Id ${id} exceeds maximum terrains (${this.MAX_TERRAINS}).`); }

    super.set(id, terrain);
    this.#nextId = this.#findNextId();
    return id;
  }

  /**
   * Add using the next consecutive id.
   */
  add(terrain) {
    const id = this.#nextId;
    if ( id > this.MAX_TERRAINS ) { console.warn(`Id ${id} exceeds maximum terrains (${this.MAX_TERRAINS}).`); }
    super.set(id, terrain);
    this.#nextId = this.#findNextId();
    return id;
  }

  /**
   * Locate the next id in consecutive order.
   */
  #findNextId() {
    // Next id is always the smallest available. So if it equals the size, we can just increment by 1.
    if ( this.size === (this.#nextId - 1) ) return this.#nextId + 1;

    const keys = [...this.keys()].sort((a, b) => a - b);
    const lastConsecutiveKey = keys.find((k, idx) => keys[idx + 1] !== k + 1);
    return lastConsecutiveKey + 1 ?? 1;
  }

  /** @override */
  clear() {
    super.clear();
    this.#nextId = 1;
  }

  /** @override */
  delete(id) {
    if ( !super.delete(id) ) return false;
    if ( this.#nextId > id ) this.#nextId = this.#findNextId();
    return true;
  }
}

/**
 * Terrain data is used here, but ultimately stored in flags in an active effect in a hidden item,
 * comparable to what DFred's does. The active effect can be used to apply the terrain to a token,
 * imposing whatever restrictions are desired.
 * Scenes store a TerrainMap that links each terrain to a pixel value.
 */
export class Terrain {
  /** @type {number} */
  #pixelId;

  /**
   * @typedef {Object} TerrainConfig          Terrain configuration data
   * @property {string} name                  User-facing name of the terrain.
   * @property {string} icon                  URL of icon representing the terrain
   * @property {hex} color                    Hex value for the color representing the terrain
   * @property {FLAGS.ANCHOR.CHOICES} anchor  Measure elevation as fixed, from terrain, or from layer.
   * @property {number} offset                Offset elevation from anchor
   * @property {number} rangeAbove            How far above the offset the terrain extends
   * @property {number} rangeBelow            How far below the offset the terrain extends
   * @property {boolean} userVisible          Is this terrain visible to the user?
   * @property {ActiveEffect} activeEffect    Active effect associated with this terrain
   */

  /** @type {TerrainSettings} */
  _settings;

  /**
   * @param {TerrainConfig} config
   * @param {object} [opts]
   * @param {boolean} [opts.override=false]     Should this terrain replace an existing id?
   */
  constructor(activeEffect) {
    this._effectHelper = new EffectHelper(activeEffect);
  }

  /**
   * Construct a Terrain given an effect id.
   * @param {string} id   Active effect id
   * @returns {Terrain}
   */
  static fromEffectId(id){
    const effect = EffectHelper.getTerrainEffectById(id);
    return new this(effect);
  }

  /**
   * @param {TerrainConfig} config
   */
  async initialize(config) {
    await this._effectHelper.initialize(config);
  }

  // NOTE: ----- Static methods -----

  /**
   * Load all terrains stored in the TerrainsItem.
   * @returns {Terrain[]}
   */
  static getAll() {
    const effects = EffectHelper.getAll();
    const terrains = effects.map(e => new this(e));
    return terrains;
  }

  // NOTE: ----- Getters/Setters -----

  /** @type {ActiveEffect} */
  get activeEffect() { return this._effectHelper.effect; }

  /** @type {string} */
  get name() { return this.activeEffect.name; }

  set name(value) { this.activeEffect.name = value; }

  /** @type {string} */
  get description() { return this.activeEffect.description; }

  set description(value) { this.activeEffect.description = value; }

  /** @type {string} */
  get icon() { return this.activeEffect.icon; }

  set icon(value) { this.activeEffect.icon = value; }

  /** @type {string} */
  get id() { return this.activeEffect.id; }

  /** @type {string} */
  get uuid() { return this.activeEffect.uuid; }

  /** @type {FLAGS.ANCHOR.CHOICES} */
  get anchor() { return this.#getAEFlag(FLAGS.ANCHOR.VALUE); }

  set anchor(value) { this.#setAEFlag(FLAGS.ANCHOR.VALUE, value); }

  async setAnchor(value) { return this.#setAEFlag(FLAGS.ANCHOR, value); }

  /** @type {number} */
  get offset() { return this.#getAEFlag(FLAGS.OFFSET); }

  set offset(value) { this.#setAEFlag(FLAGS.OFFSET, value); }

  async setOffset(value) { return this.#setAEFlag(FLAGS.OFFSET, value); }

  /** @type {number} */
  get rangeBelow() { return this.#getAEFlag(FLAGS.RANGE_BELOW); }

  set rangeBelow(value) { this.#setAEFlag(FLAGS.RANGE_BELOW, value); }

  async setRangeBelow(value) { return this.#setAEFlag(FLAGS.RANGE_BELOW, value); }

  /** @type {number} */
  get rangeAbove() { return this.#getAEFlag(FLAGS.RANGE_ABOVE); }

  set rangeAbove(value) { this.#setAEFlag(FLAGS.RANGE_ABOVE, value); }

  async setRangeAbove(value) { return this.#setAEFlag(FLAGS.RANGE_ABOVE, value); }

  /** @type {boolean} */
  get userVisible() { return this.#getAEFlag(FLAGS.USER_VISIBLE); }

  set userVisible(value) { this.#setAEFlag(FLAGS.USER_VISIBLE, value); }

  async setUserVisible(value) { return this.#setAEFlag(FLAGS.USER_VISIBLE, value); }

  /** @type {string} */
  get color() { return this.#getAEFlag(FLAGS.COLOR); }

  set color(value) { this.#setAEFlag(FLAGS.COLOR, value); }

  async setColor(value) { return this.#setAEFlag(FLAGS.COLOR, value); }

  // Helpers to get/set the active effect flags.
  #getAEFlag(flag) { return this.activeEffect.getFlag(MODULE_ID, flag); }

  async #setAEFlag(flag, value) { return this.activeEffect.setFlag(MODULE_ID, flag, value); }


  // NOTE: ----- Scene map -----
  addToScene() {

  }

  removeFromScene() {

  }

  /**
   * Calculate the elevation min / max for a given anchor elevation.
   * @param {number} anchorE    Elevation of the anchor point.
   * @returns {object} Elevation min and max.
   *   - {number} min   Minimum elevation
   *   - {number} max   Maximum elevation
   */
  elevationMinMax(anchorE) {
    const { offset, rangeBelow, rangeAbove } = this;
    const e = anchorE + offset;
    return { min: e + rangeBelow, max: e + rangeAbove };
  }

  // NOTE: ---- File in/out -----

  toJSON() {
    const out = this.config;
    out.activeEffect = out.activeEffect ? out.activeEffect.toJSON() : undefined;
    return out;
  }

  updateSource(json) {
    const config = this.config;
    for ( const [key, value] of Object.entries(json) ) {
      if ( key === "id" ) continue;
      if ( key === "activeEffect" ) {
        config.activeEffect = config.activeEffect ? config.activeEffect.updateSource(value) : new ActiveEffect(value);
        continue;
      }
      config[key] = value;
    }
  }

  /**
   * Export the entire terrains item to JSON.
   */
  static exportToJSON() {
    const item = TerrainSettings.terrainEffectsItem;
    const data = item.toJSON();
    data.flags.exportSource = {
      world: game.world.id,
      system: game.system.id,
      coreVersion: game.version,
      systemVersion: game.system.version,
      terrainMapperVersion: game.modules.get(MODULE_ID).version
    };
    const filename = `${MODULE_ID}_terrains`;
    saveDataToFile(JSON.stringify(data, null, 2), "text/json", `${filename}.json`);
  }

  /**
   * Import the entire terrains item and replace the existing.
   */
  static async replaceFromJSON(json) {
    const item = TerrainSettings.terrainEffectsItem;
    await item.importFromJSON(json);
    // TODO: Replace scene terrain map(s)?

  }

  /**
   * Import the entire terrains item and add all effects as additional terrains to the existing.
   */
  static async importFromJSON(json) {
    const item = TerrainSettings.terrainEffectsItem;
    const tmp = CONFIG.Item.documentClass.fromJSON(json);

    // Transfer the active effects to the existing item.
    await item.createEmbeddedDocuments("ActiveEffect", tmp.effects.toObject());
    // await tmp.delete();
  }

  /**
   * Dialog to confirm that import should occur.
   */
  static async importFromJSONDialog() {
    // See https://github.com/DFreds/dfreds-convenient-effects/blob/c2d5e81eb1d28d4db3cb0889c22a775c765c24e3/scripts/effects/custom-effects-handler.js#L156
    const content = await renderTemplate("templates/apps/import-data.html", {
      hint1: "You may import terrain settings data from an exported JSON file.",
      hint2: "This operation will add the terrains in the JSON to the existing terrains set."
    });

    const importPromise = new Promise((resolve, reject) => {
      new Dialog({
        title: "Import Multiple Terrains Setting Data",
        content,
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: "Import",
            callback: html => {
              const form = html.find("form")[0];
              if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
              readTextFromFile(form.data.files[0]).then(json => this.importFromJSON(json));
              resolve(true);
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel"
          }
        },
        default: "import"
      }, {
        width: 400
      }).render(true);
    });

    await importPromise;
    TerrainEffectsApp.rerender();
  }

  /**
   * Dialog to confirm that replacement should occur.
   */
  static async replaceFromJSONDialog() {
    // See https://github.com/DFreds/dfreds-convenient-effects/blob/c2d5e81eb1d28d4db3cb0889c22a775c765c24e3/scripts/effects/custom-effects-handler.js#L156
    const content = await renderTemplate("templates/apps/import-data.html", {
      hint1: "You may replace terrain settings data using an exported JSON file.",
      hint2: "WARNING: This operation will replace all terrain settings data and cannot be undone."
    });

    const importPromise = new Promise((resolve, reject) => {
      new Dialog({
        title: "Replace All Terrain Setting Data",
        content,
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: "Import",
            callback: html => {
              const form = html.find("form")[0];
              if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
              readTextFromFile(form.data.files[0]).then(json => this.replaceFromJSON(json));
              resolve(true);
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel"
          }
        },
        default: "import"
      }, {
        width: 400
      }).render(true);
    });

    await importPromise;
    TerrainEffectsApp.rerender();
  }

  exportToJSON() {
    const data = this.activeEffect.toJSON();
    data.flags.exportSource = {
      world: game.world.id,
      system: game.system.id,
      coreVersion: game.version,
      systemVersion: game.system.version,
      terrainMapperVersion: game.modules.get(MODULE_ID).version
    };

    const filename = `${MODULE_ID}_${this.name}`;
    saveDataToFile(JSON.stringify(data, null, 2), "text/json", `${filename}.json`);
  }

  async importFromJSON(json) {
    await this.activeEffect.importFromJSON(json);
  }

  async importFromJSONDialog() {
    new Dialog({
      title: "Import Terrain Setting Data",
      content: await renderTemplate("templates/apps/import-data.html", {
        hint1: "You may import terrain settings data from an exported JSON file.",
        hint2: "This operation will update the terrain settings data and cannot be undone."
      }),
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Import",
          callback: html => {
            const form = html.find("form")[0];
            if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
            readTextFromFile(form.data.files[0]).then(json => this.importFromJSON(json));
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "import"
    }, {
      width: 400
    }).render(true);
  }
}
