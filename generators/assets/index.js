const fs = require('fs');
const Base = require('yeoman-generator');
const imageGenerator = require('./imageGenerator');
const getPixelColor = require('./getPixelColor');

class ResourcesGenerator extends Base {
  constructor(...args) {
    super(...args);

    this.option('icon', {
      type: asset => asset,
      desc: 'Icon source',
    });
    this.option('splash', {
      type: asset => asset,
      desc: 'Splashscreen source',
    });
    this.option('android', {
      desc: 'Build for Android',
    });
    this.option('iOS', {
      desc: 'Build for iOS',
    });
    this.option('android-notification-icon', {
      type: asset => asset,
      desc: 'Notification icon source',
    });
    this.option('store', {
      desc: 'Generate Stores assets',
    });
  }

  initializing() {
    this.composeWith('rn-toolbox:checkversion');
  }

  prompting() {
    const config = this.fs.readJSON(this.destinationPath('package.json'));
    return this.prompt([{
      type: 'input',
      name: 'projectName',
      message: 'Name of your react-native project',
      required: true,
      default: config.name,
    }]).then((answers) => {
      this.answers = answers;
    });
  }

  writing() {
    this._checkOSToBuildFor();
    this._checkAssets();

    return Promise.all([
      this._setupIosIcons(),
      this._setupAndroidIcons(),
      this._setupAndroidNotificationIcons(),
      this._setupIosSplashScreen(),
      this._setupAndroidSplashScreen(),
      this._setupStoresAssets(),
    ]);
  }

  _checkOSToBuildFor() {
    this.android = this.options.android || !this.options.ios;
    this.ios = this.options.ios || !this.options.android;
  }

  _checkAssets() {
    this._checkAsset('icon');
    this._checkAsset('splash');
    this._checkAsset('android-notification-icon');
  }

  _checkAsset(optionName) {
    const assetPath = this.options[optionName];

    if (assetPath && !fs.existsSync(assetPath)) {
      this.log.error(`${optionName} could not be found`);
      this.options[optionName] = null;
    }
  }

  _setupIosIcons() {
    if (!this.ios || !this.options.icon) return null;

    const iosIconFolder = `ios/${this.answers.projectName}/Images.xcassets/AppIcon.appiconset`;

    this.fs.copyTpl(
      this.templatePath('ios/AppIconsetContents.json'),
      this.destinationPath(`${iosIconFolder}/Contents.json`)
    );

    return imageGenerator.generateIosIcons(
      this.options.icon,
      iosIconFolder
    );
  }

  _setupAndroidIcons() {
    if (!this.android || !this.options.icon) return null;
    return imageGenerator.generateAndroidIcons(this.options.icon);
  }

  _setupAndroidNotificationIcons() {
    if (!this.options['android-notification-icon']) return null;
    return imageGenerator.generateAndroidNotificationIcons(this.options['android-notification-icon']);
  }

  _setupIosSplashScreen() {
    if (!this.ios || !this.options.splash) return null;

    const iosSplashFolder = `ios/${this.answers.projectName}/Images.xcassets/LaunchImage.launchimage`;

    this.fs.copyTpl(
      this.templatePath('ios/LaunchImageLaunchimageContents.json'),
      `${iosSplashFolder}/Contents.json`
    );

    const pbxprojPath = this.destinationPath(`ios/${this.answers.projectName}.xcodeproj/project.pbxproj`);
    this.fs.write(pbxprojPath, this.fs.read(pbxprojPath)
      .replace(
        /ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/g,
        `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
                               ASSETCATALOG_COMPILER_LAUNCHIMAGE_NAME = LaunchImage;`
      )
    );

    const plistPath = this.destinationPath(`ios/${this.answers.projectName}/Info.plist`);
    this.fs.write(plistPath, this.fs.read(plistPath)
      .replace('<key>UILaunchStoryboardName</key>', '')
      .replace('<string>LaunchScreen</string>', '')
    );

    return imageGenerator.generateIosSplashScreen(
      this.options.splash,
      iosSplashFolder
    );
  }

  _setupAndroidSplashScreen() {
    if (!this.android || !this.options.splash) return null;

    const getTopLeftPixelColor = getPixelColor(this.options.splash, 1, 1);

    return getTopLeftPixelColor.then((splashBackgroundColor) => {
      this.fs.copyTpl(
        this.templatePath('android/colors.xml'),
        'android/app/src/main/res/values/colors.xml',
        { splashBackgroundColor }
      );
      this.fs.copyTpl(
        this.templatePath('android/launch_screen_bitmap.xml'),
        'android/app/src/main/res/drawable/launch_screen_bitmap.xml'
      );

      this.fs.copyTpl(
        this.templatePath('android/styles.xml'),
        'android/app/src/main/res/values/styles.xml'
      );

      return imageGenerator.generateAndroidSplashScreen(this.options.splash);
    });
  }

  _setupStoresAssets() {
    if (!this.options.store) return null;

    const resizePromises = [];

    if (this.android && this.options.icon) {
      resizePromises.push(imageGenerator.generatePlayStoreIcon(this.options.icon));
    }
    if (this.ios && this.options.icon) {
      resizePromises.push(imageGenerator.generateItunesIcon(this.options.icon));
    }
    if (this.android && this.options.splash) {
      resizePromises.push(imageGenerator.generatePlayStoreImage(this.options.splash));
    }

    return Promise.all(resizePromises);
  }
}

module.exports = ResourcesGenerator;
