from flask import Flask, send_from_directory

# Serve index.html at "/" and everything in css/ + js/ as static files
app = Flask(__name__, static_folder=".", static_url_path="")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
