# Brained

An AI powered second brain application

## Installation

### Installing the newest release

You can install Brained by downloading the newest release `.AppImage` file. The unpacked version is also available.

### Installing from source

In your shell, write the following command:

```sh
npm install
npm run electron:dist
```

The files will be available inside the `release/` directory.

## Setting up the second brain

Brained stores all your data as `.md` or `.csv` files in `~/brained` (created automatically on first launch). The `AGENTS.md` file with the rules for the agent is embedded in the app and copied there, and your notes live inside `~/brained/content`. No configuration is needed.

The application is available in English and Spanish.

## Future updates

It is planned a 1.1.0 version with encryption for the second brain data.
