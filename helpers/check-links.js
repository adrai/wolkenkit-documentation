'use strict';

const path = require('path');

const blc = require('broken-link-checker'),
      flaschenpost = require('flaschenpost'),
      knock = require('knockat'),
      runfork = require('runfork');

const metadata = require('../src/docs/metadata');

const logger = flaschenpost.getLogger();

runfork({ path: path.join(__dirname, '..', 'app.js') }, (errRunfork, stop) => {
  if (errRunfork) {
    logger.error('Failed to start server.', { err: errRunfork });
    /* eslint-disable no-process-exit */
    process.exit(1);
    /* eslint-enable no-process-exit */
  }

  knock.at('localhost', 8000, errKnock => {
    if (errKnock) {
      logger.error('Failed to reach http://localhost:8000.', { err: errKnock });

      stop();

      /* eslint-disable no-process-exit */
      process.exit(1);
      /* eslint-enable no-process-exit */
    }

    logger.info('Checking links...');

    let brokenLinkCount = 0;

    const htmlUrlChecker = new blc.HtmlUrlChecker({
      excludedKeywords: [ 'https://github.com/thenativeweb/*' ]
    }, {
      link (result) {
        if (!result.broken) {
          return;
        }

        brokenLinkCount += 1;
        logger.error('Broken link found.', {
          page: result.base.original,
          link: result.url.original,
          description: result.html.text
        });
      },
      end () {
        stop();

        if (brokenLinkCount > 0) {
          /* eslint-disable no-process-exit */
          process.exit(1);
          /* eslint-enable no-process-exit */
        }

        logger.info('All links are fine.');
        /* eslint-disable no-process-exit */
        process.exit(0);
        /* eslint-enable no-process-exit */
      }
    });

    const findLinks = function (children, baseUrl) {
      children.forEach(child => {
        if (child.children) {
          return findLinks(child.children, `${baseUrl}/${child.slug}`);
        }

        htmlUrlChecker.enqueue(`${baseUrl}/${child.slug}/`);
      });
    };

    Object.keys(metadata.versions).forEach(version => {
      findLinks(metadata.navigation[version], `http://localhost:8000/${version}`);
    });
  });
});
