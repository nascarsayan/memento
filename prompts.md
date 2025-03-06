
1. Extension captures the data from the web pages and saves the DOM data in a local folder
2. A daemon job written in golang picks up the unprocessed web pages and other data and indexes them locally.
3. During search time, the extension asks the daemon to search the indexed data and return the results.
4. The process is running on some HTTP server and the extension communicates with the server to get the search results. For saving files this HTTP communication is not needed, only for querying the indexed data.

---

