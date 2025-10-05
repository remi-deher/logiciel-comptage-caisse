<?php
// tests/VersionServiceTest.php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/services/VersionService.php';

class VersionServiceTest extends TestCase
{
    private $versionFile;
    private $cacheDir;

    protected function setUp(): void
    {
        $this->versionFile = __DIR__ . '/../VERSION';
        $this->cacheDir = __DIR__ . '/../cache';
        if (file_exists($this->cacheDir . '/github_release.json')) {
            unlink($this->cacheDir . '/github_release.json');
        }
    }

    protected function tearDown(): void
    {
        if (file_exists($this->versionFile)) {
            unlink($this->versionFile);
        }
    }

    public function testGetLocalVersion()
    {
        file_put_contents($this->versionFile, 'v1.2.3');
        $versionService = new VersionService();
        $this->assertEquals('v1.2.3', $versionService->getLocalVersion());
    }

    public function testUpdateIsAvailableWhenRemoteIsNewer()
    {
        file_put_contents($this->versionFile, 'v1.0.0');

        $versionServiceMock = $this->getMockBuilder(VersionService::class)
                                   ->onlyMethods(['fetchFromApi']) // On précise la méthode à mocker
                                   ->getMock();

        $fakeApiResponse = [
            'success' => true,
            'data' => [
                'tag_name' => 'v1.1.0',
                'body' => 'Nouvelles fonctionnalités',
                'html_url' => 'http://example.com',
                'published_at' => '2025-01-01T12:00:00Z'
            ]
        ];
        $versionServiceMock->method('fetchFromApi')->willReturn($fakeApiResponse);
        
        $result = $versionServiceMock->getLatestReleaseInfo(true); 

        $this->assertTrue($result['update_available']);
        $this->assertEquals('v1.0.0', $result['local_version']);
        $this->assertEquals('v1.1.0', $result['remote_version']);
    }
}
