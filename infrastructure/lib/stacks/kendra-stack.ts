// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, Construct, StackProps, CfnOutput } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import KendraIndex from '../constructs/kendra/kendra-index';
import KendraS3DataSource from '../constructs/kendra/kendra-s3-data-source';
import { KendraInfrastructureProps } from './web-crawler-stack';

/**
 * This stack deploys the kendra infrastructure to enable the "search engine" part of this sample.
 * It's an optional part of the sample - see the README for more details.
 */
export class KendraStack extends Stack {
  public readonly kendra: KendraInfrastructureProps;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Bucket to store our crawled webpages
    const dataSourceBucket = new Bucket(this, 'KendraDataSourceBucket');

    // Kendra index
    const kendraIndex = new KendraIndex(this, 'KendraIndex').index;

    // Kendra data source
    const kendraDataSource = new KendraS3DataSource(this, 'KendraDataSource', {
      index: kendraIndex,
      bucket: dataSourceBucket,
    }).dataSource;

    // Output the index id for our `crawl` utility script to generate a link to the Kendra console
    new CfnOutput(this, 'CrawlerKendraIndexId', {
      exportName: 'CrawlerKendraIndexId',
      value: kendraIndex.attrId,
    });

    this.kendra = {
      kendraIndex,
      kendraDataSource,
      dataSourceBucket,
    };
  }
}
