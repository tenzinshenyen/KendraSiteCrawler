// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Stack, StackProps, Construct } from '@aws-cdk/core';
import { CfnIndex, CfnDataSource } from '@aws-cdk/aws-kendra';
import { Bucket } from '@aws-cdk/aws-s3';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { Table } from '@aws-cdk/aws-dynamodb';
import WebCrawlerStepLambdas from '../constructs/webcrawler/web-crawler-step-lambdas';
import { AttributeType } from '@aws-cdk/aws-dynamodb';
import WebCrawlerStateMachine from '../constructs/webcrawler/web-crawler-state-machine';
import { WEB_CRAWLER_STATE_MACHINE_NAME } from '../constructs/webcrawler/constants';

export interface KendraInfrastructureProps {
  dataSourceBucket: Bucket;
  kendraIndex: CfnIndex;
  kendraDataSource: CfnDataSource;
}

export interface WebCrawlerStackProps extends StackProps {
  kendra?: KendraInfrastructureProps;
}

/**
 * This stack deploys the serverless webcrawler
 */
export class WebCrawlerStack extends Stack {

  constructor(scope: Construct, id: string, props: WebCrawlerStackProps) {
    super(scope, id, props);

    // Dynamodb table to store our web crawl history
    const historyTable = new Table(this, 'CrawlerHistoryTable', {
      partitionKey: {
        name: 'crawlId',
        type: AttributeType.STRING,
      },
    });

    // Each time we trigger a crawl, we'll create a temporary "context" dynamodb table to keep track of the discovered
    // urls and whether or not they have been visited
    const contextTableNamePrefix = 'web-crawler-context';

    // Helper method to create a policy to perform the given actions on any dynamodb context table
    const createContextTablePolicy = (actions: string[]) => new PolicyStatement({
      effect: Effect.ALLOW,
      actions: actions.map((action) => `dynamodb:${action}`),
      resources: [this.formatArn({
        service: 'dynamodb',
        resource: 'table',
        resourceName: `${contextTableNamePrefix}*`,
      })],
    });

    // We construct this manually rather than using the output of the WebCrawlerStateMachine to avoid a circular
    // dependency. The 'continueExecution' lambda needs permissions to start the state machine in which it resides.
    const webCrawlerStateMachineArn = this.formatArn({
      service: 'states',
      resource: 'stateMachine',
      resourceName: WEB_CRAWLER_STATE_MACHINE_NAME,
      sep: ':',
    });

    // Create all the lambdas for our webcrawler
    const { steps } = new WebCrawlerStepLambdas(this, 'WebCrawlerStepLambdas', {
      region: this.region,
      contextTableNamePrefix,
      createContextTablePolicy,
      kendra: props.kendra,
      historyTable,
      webCrawlerStateMachineArn,
    });

    // Create the state machine
    new WebCrawlerStateMachine(this, 'WebCrawlerStateMachine', { steps });
  }
}
