# Direct GitHub Pages Deployment

This package is deliberately build-free.

## Upload

The GitHub repository root must display:

```text
index.html
config.js
assets/
supabase/
docs/
templates/
.nojekyll
404.html
favicon.svg
README.md
```

Do not upload the outer ZIP folder as another nested folder.

## Pages setting

Open:

```text
Repository → Settings → Pages
```

Set:

```text
Source: Deploy from a branch
Branch: main
Folder: /(root)
```

The live address will normally be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

All asset paths are relative, so the app works under a project repository path.
