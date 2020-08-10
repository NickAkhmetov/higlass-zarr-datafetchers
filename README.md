[![npm](https://img.shields.io/npm/v/higlass-zarr-datafetchers)](https://www.npmjs.com/package/higlass-zarr-datafetchers)
[![npm bundle size](https://img.shields.io/bundlephobia/min/higlass-zarr-datafetchers)](https://unpkg.com/browse/higlass-zarr-datafetchers/)

# higlass-zarr-datafetchers

This repository contains plugin data fetchers for loading [Zarr](https://zarr.readthedocs.io/en/stable/)-based files in HiGlass.
These plugins allow data to be stored in object stores such as S3 (rather than using [higlass-server](https://github.com/higlass/higlass-server)).
Plugin data fetchers can be registered using [higlass-register](https://github.com/higlass/higlass-register).

```sh
yarn add zarr # peer dependency
yarn add higlass-register # helpers for plugin registration
yarn add higlass-zarr-datafetchers
```

List of data fetchers currently implemented:

- `zarr-multivec`: Use this data fetcher with a `horizontal-multivec` track to visualize multi-sample genome-wide continuous data with a heatmap.

## Develop

### Install dependencies
```sh
yarn
```

### Run the demo

```sh
yarn run start
```

## Build

```sh
yarn run build
```

## Conversion resources

Coming soon: [higlass-zarr-converters](https://github.com/keller-mark/higlass-zarr-converters)

_For the current demo, Zarr files were generated using [this script](https://github.com/hms-dbmi/cistrome-explorer/blob/221fc8c183f0e03f83059a6735f5dbe48217b4d3/pipelines/cistrome-to-multivec/src/manifest_to_zarr.py)_