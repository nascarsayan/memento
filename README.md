# Memento

## About
For the forgetful, by the forgetful - Capture and index your journey on the internet for your future self

## What is Memento?
Memento is a browser extension that helps you remember and search through websites you've visited. It captures the content of web pages you browse, indexes them locally, and allows you to search through them later, even when offline.

## Development Status

- [x] Capture and store the DOM content of web pages
- [] Give importance to content based on user interaction
- [] Implement a search interface in the browser extension
- [] Implement the indexing process

## Features
- **Web Page Capture**: Automatically saves the DOM content of pages you visit
- **Local Indexing**: Processes and indexes captured content for efficient searching
- **Smart Attention Tracking**: Weighs content based on viewing time, cursor movement, and scroll behavior
- **Privacy-First**: All data stays on your device, no cloud storage required
- **Offline Search**: Find information from your browsing history without needing the original site

## How It Works
1. The browser extension captures DOM data from web pages you visit
2. A daemon written in Go indexes the captured content locally
3. When searching, the extension queries the daemon via HTTP to retrieve relevant results
4. The system prioritizes content that received more of your attention based on metrics like:
   - Time spent in viewport
   - Cursor movements
   - Scroll speed and patterns

## Installation
```bash
# Clone the repository
git clone https://github.com/nascarsayan/memento.git

# Navigate to the project directory
cd memento

# Load the `extension` directory in your browser as an unpacked extension

# Build and run the daemon
cd daemon
go build
./daemon
```

The daemon should now be running and ready to receive search queries from the extension. (TODO: Improve the indexing process)


## Architecture
Memento consists of two main components:
1. **Browser Extension**: Captures web page data and provides the search interface
2. **Local Daemon**: Go service that indexes content and handles search queries

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Contact
- GitHub: [@nascarsayan](https://github.com/nascarsayan)
