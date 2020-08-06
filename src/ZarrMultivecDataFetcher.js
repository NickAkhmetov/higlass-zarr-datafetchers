import { v4 as uuidv4 } from 'uuid';
import { HTTPStore, openArray, slice } from 'zarr';
import { abs2genomic, genomicRangeToChromosomeChunks, multivecChunksToTileDenseArray } from './utils';

const ZarrMultivecDataFetcher = function ZarrMultivecDataFetcher(HGC, ...args) {

  if (!new.target) {
        throw new Error(
          'Uncaught TypeError: Class constructor cannot be invoked without "new"',
        );
    }

    const { absToChr, DenseDataExtrema1D, minNonZero, maxNonZero } = HGC.utils;

    class ZarrMultivecDataFetcherClass {
        constructor(dataConfig) {
            this.dataConfig = dataConfig;
            this.trackUid = uuidv4();
        
            if (dataConfig.url) {
              // console.assert(dataConfig.url.endsWith('.zarr'));
              // S3 bucket must have a CORS policy to allow reading from any origin.
              this.store = new HTTPStore(dataConfig.url);
            }
        }

        tilesetInfo(callback) {
            this.tilesetInfoLoading = true;
        
            // Use the tileset_info stored as JSON in file.zarr/.zattrs
            return this.store
              .getItem('.zattrs')
              .then(bytes => {
                const decoder = new TextDecoder('utf-8');
                const json = JSON.parse(decoder.decode(bytes));
                return json;
              })
              .then(attrs => {
                this.tilesetInfoLoading = false;

                const chromSizes = attrs.multiscales.map(d => ([d.name, d.metadata.chromsize]));
                
                const finalChrom = attrs.multiscales[attrs.multiscales.length - 1];
                const maxPos = finalChrom.metadata.chromoffset + finalChrom.metadata.chromsize;
                const tileSize = attrs.shape[1];
                const retVal = {
                  ...attrs,
                  shape: [attrs.shape[1], attrs.shape[0]],
                  chromSizes,
                  tile_size: tileSize,
                  max_width: maxPos,
                  min_pos: [0],
                  max_pos: [maxPos],
                  max_zoom: Math.ceil(Math.log(maxPos / tileSize) / Math.log(2)),
                };
        
                if (callback) {
                  callback(retVal);
                }
        
                return retVal;
              })
              .catch(err => {
                this.tilesetInfoLoading = false;
        
                if (callback) {
                  callback({
                    error: `Error parsing zarr multivec: ${err}`,
                  });
                }
              });
          }
        
          fetchTilesDebounced(receivedTiles, tileIds) {
            const tiles = {};
        
            const validTileIds = [];
            const tilePromises = [];
        
            for (const tileId of tileIds) {
              const parts = tileId.split('.');
              const z = parseInt(parts[0], 10);
              const x = parseInt(parts[1], 10);
        
              if (Number.isNaN(x) || Number.isNaN(z)) {
                console.warn('Invalid tile zoom or position:', z, x);
                continue;
              }
        
              validTileIds.push(tileId);
              tilePromises.push(this.tile(z, x, tileId));
            }
        
            Promise.all(tilePromises).then(values => {
              for (let i = 0; i < values.length; i++) {
                const validTileId = validTileIds[i];
                tiles[validTileId] = values[i];
                tiles[validTileId].tilePositionId = validTileId;
              }
              receivedTiles(tiles);
            });
            return tiles;
          }
        
          tile(z, x, tileId) {
            const { store } = this;
            return this.tilesetInfo().then(tsInfo => {
              // const multiscales = tsInfo.multiscales;
        
              // Adapted from clodius.tiles.multivec.get_single_tile
              // Reference: https://github.com/higlass/clodius/blob/develop/clodius/tiles/multivec.py#L66
        
              // z is the index of the resolution that should be selected.
              // Resolution is size of each bin (except for the last bin in each chromosome).
              const resolution = +tsInfo.resolutions[z];
              const tileSize = +tsInfo.tile_size;
              const binSize = resolution;
        
              // Where in the data does the tile start and end?
              const tileStart = x * tileSize * resolution;
              const tileEnd = tileStart + tileSize * resolution;
        
              // chromSizes is an array of "tuples" [ ["chr1", 1000], ... ]
              const chromSizes = tsInfo.chromSizes;
        
              // Adapted from clodius.tiles.multivec.get_tile
              // Reference: https://github.com/higlass/clodius/blob/develop/clodius/tiles/multivec.py#L110
        
              const [genomicStart, genomicEnd] = abs2genomic(
                absToChr,
                chromSizes,
                tileStart,
                tileEnd,
              );
        
              // Using the [genomicStart, genomicEnd] range, get an array of "chromosome chunks",
              // where each chunk range starts and ends with the same chromosome.
              // Start a new chromosome chunk at each chromosome boundary.
              const chrChunks = genomicRangeToChromosomeChunks(
                chromSizes,
                genomicStart,
                genomicEnd,
                binSize,
                tileSize,
              );
        
              // Get the zarr data for each chromosome chunk,
              // since data for each chromosome is stored in a separate zarr array.
              return Promise.all(
                chrChunks.map(([chrName, zStart, zEnd]) => {
                  return openArray({
                    store,
                    path: `/chromosomes/${chrName}/${resolution}/`,
                    mode: 'r',
                  }).then(arr => arr.get([null, slice(zStart, zEnd)]));
                }),
              ).then(chunks => {
                const dense = multivecChunksToTileDenseArray(chunks, [tsInfo.shape[1], tsInfo.shape[0]]);
                return Promise.resolve({
                  dense,
                  denseDataExtrema: new DenseDataExtrema1D(dense),
                  dtype: 'float32',
                  min_value: Math.min.apply(null, dense),
                  max_value: Math.max.apply(null, dense),
                  minNonZero: minNonZero(dense),
                  maxNonZero: maxNonZero(dense),
                  server: null,
                  size: 1,
                  shape: tsInfo.shape,
                  tileId,
                  tilePos: [x],
                  tilePositionId: tileId,
                  tilesetUid: null,
                  zoomLevel: z,
                });
              });
            });
        }
    } // end class
    return new ZarrMultivecDataFetcherClass(...args);
} // end function wrapper


ZarrMultivecDataFetcher.config = {
    type: 'zarr-multivec',
};

export default ZarrMultivecDataFetcher;
