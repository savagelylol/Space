import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { hostname } from 'node:os';
import chalk from 'chalk';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import routes from './src/routes.js';

const server = http.createServer();
const app = express();
const __dirname = process.cwd();
const PORT = process.env.PORT || 6060;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/@/', express.static(uvPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));
app.use('/', routes);







const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Your existing middleware and routes (if any)...

// Proxy setup for /a route
app.use('/a', (req, res, next) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }
  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { '^/a': '' },
    onError: (err, req, res) => {
      res.status(500).send('Proxy error occurred');
    }
  });
  proxy(req, res, next);
});
















server.on('request', (req, res) => {
	app(req, res);
});

server.on('upgrade', (req, socket, head) => {
	if (req.url.endsWith('/wisp/')) {
		wisp.routeRequest(req, socket, head);
	} else {
		socket.end();
	}
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

server.on('listening', () => {
	const address = server.address();
	const theme = chalk.hex('#8F00FF');
	const host = chalk.hex('0d52bd');
	console.log(
		chalk.bold(
			theme(`
	███████╗██████╗  █████╗  ██████╗███████╗
	██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝
	███████╗██████╔╝███████║██║     █████╗  
	╚════██║██╔═══╝ ██╔══██║██║     ██╔══╝  
	███████║██║     ██║  ██║╚██████╗███████╗
	╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝
											
	`)
		)
	);
	console.log(
		`  ${chalk.bold(host('Local System:'))}            http://${address.family === 'IPv6' ? `[${address.address}]` : address.address}${address.port === 80 ? '' : ':' + chalk.bold(address.port)}`
	);

	console.log(
		`  ${chalk.bold(host('Local System:'))}            http://localhost${address.port === 8080 ? '' : ':' + chalk.bold(address.port)}`
	);

	try {
		console.log(
			`  ${chalk.bold(host('On Your Network:'))}  http://${hostname()}${address.port === 8080 ? '' : ':' + chalk.bold(address.port)}`
		);
	} catch (err) {
		// can't find LAN interface
	}

	if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
		console.log(
			`  ${chalk.bold(host('Replit:'))}           https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
		);
	}

	if (process.env.HOSTNAME && process.env.GITPOD_WORKSPACE_CLUSTER_HOST) {
		console.log(
			`  ${chalk.bold(host('Gitpod:'))}           https://${PORT}-${process.env.HOSTNAME}.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`
		);
	}

	if (
		process.env.CODESPACE_NAME &&
		process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
	) {
		console.log(
			`  ${chalk.bold(host('Github Codespaces:'))}           https://${process.env.CODESPACE_NAME}-${address.port === 80 ? '' : address.port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
		);
	}
});

server.listen(PORT);
