/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource:///modules/StringBundle.js");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource:///modules/gloda/log4moz.js");

// Get a configured logger for this component.
// To debug, set mail.provider.logging.dump (or .console)="All"
let gLog = Log4Moz.getConfiguredLogger("mail.provider");
let stringBundle = new StringBundle("chrome://messenger/locale/newmailaccount/accountProvisioner.properties");

let isOSX = (Services.appinfo.OS == 'Darwin');

const RETRY_TIMEOUT = 5000; // 5 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds

function isAccel (event) (isOSX && event.metaKey || event.ctrlKey)

/**
 * Get the localstorage for this page in a way that works in chrome.
 *
 * Cribbed from
 *   mozilla/dom/tests/mochitest/localstorage/test_localStorageFromChrome.xhtml
 *
 * @param {String} page The page to get the localstorage for.
 * @return {nsIDOMStorage} The localstorage for this page.
 */
function getLocalStorage(page) {
  var url = "chrome://content/messenger/accountProvisionerStorage/" + page;

  var uri = Services.io.newURI(url, "", null);
  var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
  return Services.domStorageManager.getLocalStorageForPrincipal(principal, url);
}

const MAX_SMALL_ADDRESSES = 2;

var storedData = {};

function splitName(str) {
  let i = str.lastIndexOf(" ");
  if (i >= 1)
    return [str.substring(0, i), str.substring(i + 1)];
  else
    return [str, ""];
}

/**
 * Logic and functionality for the Account Provisioner dialog.  Sets and reacts
 * to user interaction events, deals with searching and search results, and
 * tracks / maintains window state throughout the Account Provisioner workflow.
 */
var EmailAccountProvisioner = {

  _inited: false,
  _loadingProviders: false,
  _loadedProviders: false,
  _loadProviderRetryId: null,
  _storage: null,
  providers: {},
  _someProvidersChecked: false,
  // These get passed in when creating the Account Provisioner window.
  NewMailAccount: window.arguments[0].NewMailAccount,
  NewComposeMessage: window.arguments[0].NewComposeMessage,
  openAddonsMgr: window.arguments[0].openAddonsMgr,
  msgWindow: window.arguments[0].msgWindow,

  get someProvidersChecked() {
    return this._someProvidersChecked;
  },

  set someProvidersChecked(aVal) {
    this._someProvidersChecked = aVal;
    EmailAccountProvisioner.onSearchInputOrProvidersChanged();
  },

  /**
   * Get the list of loaded providers that we got back from the server.
   */
  get loadedProviders() {
    return this._loadedProviders;
  },

  /**
   * Returns the URL for retrieving suggested names from the
   * selected providers.
   */
  get suggestFromName() {
    return Services.prefs.getCharPref("mail.provider.suggestFromName");
  },

  /**
   * Returns the language that the user currently accepts.
   */
  get userLanguage() {
    return Services.prefs.getCharPref("general.useragent.locale");
  },

  /**
   * A helper function to enable or disable the Search button.
   */
  searchButtonEnabled: function EAP_searchButtonEnabled(aVal) {
    if (aVal) {
      $("#searchSubmit").removeAttr("disabled");
    } else {
      $("#searchSubmit").attr("disabled", "true");
    }
  },

  /**
   * A setter for enabling / disabling the search fields.
   */
  searchEnabled: function EAP_searchEnabled(aVal) {
    if (aVal) {
      $("#name").removeAttr("disabled");
      $(".providerCheckbox").removeAttr("disabled");
    } else {
      $("#name").attr("disabled", "true");
      $(".providerCheckbox").attr("disabled", "true");
    }
    this.searchButtonEnabled(aVal);
  },

  /**
   * If aVal is true, show the spinner, else hide.
   */
  spinning: function EAP_spinning(aVal) {
    if (aVal) {
      $("#notifications .spinner").css('display', 'block');
    } else {
      $("#notifications .spinner").css('display', 'none');
    }
  },

  /**
   * Sets the current window state to display the "success" page, with options
   * for composing messages, setting a signature, finding add-ons, etc.
   */
  showSuccessPage: function EAP_showSuccessPage() {
    gLog.info("Showing the success page");
    let engine = Services.search.getEngineByName(window.arguments[0].search_engine);
    let account = window.arguments[0].account;

    if (engine && Services.search.defaultEngine != engine) {
      // Expose the search engine checkbox
      $("#search_engine_wrap").show()
                              .click(function(event) {
        $("#search_engine_check").click();
        return false;
      });

      $("#search_engine_check").click(function(event) {
        event.stopPropagation();
      });

      // Set up the fields...
      $("#search_engine_check").prop("checked", true);
      $("#search_engine_desc").html(stringBundle.get("searchDesc", [engine.name]));
    }

    $("#success-compose").click(function() {
      MailServices.compose.OpenComposeWindow(null, null, null,
                                             Ci.nsIMsgCompType.New,
                                             Ci.nsIMsgCompFormat.Default,
                                             account.defaultIdentity, null);
    });

    $("#success-addons").click(function() {
      EmailAccountProvisioner.openAddonsMgr();
    });

    $("#success-signature").click(function() {
      var existingAccountManager =
        Services.wm.getMostRecentWindow("mailnews:accountmanager");

      if (existingAccountManager)
        existingAccountManager.focus();
      else
        window.openDialog("chrome://messenger/content/AccountManager.xul",
                          "AccountManager", "chrome,centerscreen,modal,titlebar",
                          {server: account.incomingServer});
    });

    $("#window").hide();
    $("#successful_account").show();
  },

  /**
   * Save the name inputted in the search field to localstorage, so we can
   * reconstitute it on respawn later.
   */
  saveName: function EAP_saveName() {
    var name = String.trim($("#name").val());
    this.storage.setItem("name", name);
  },

  onSearchInputOrProvidersChanged: function EAP_onSearchInputOrProvidersChanged(event) {
    let emptyName = $("#name").val() == "";
    EmailAccountProvisioner.searchButtonEnabled(!emptyName
                                                && EmailAccountProvisioner
                                                   .someProvidersChecked);
  },

  /**
   * Hook up our events, populate the DOM, set our hooks, do all of our
   * prep work.  Since this is called via jQuery on document ready,
   * the value for "this" is the actual window document, hence the need
   * to explicitly refer to EmailAccountProvisioner.
   */
  init: function EAP_init() {
    // We can only init once, so bail out if we've been called again.
    if (EmailAccountProvisioner._inited)
      return;

    gLog.info("Initializing Email Account Provisioner");

    // For any anchor element that gets the "external" class, make it so that
    // when we click on that element, instead of loading up the href in the
    // window itself, we open up the link in the default browser.
    let opener = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                           .getService(Ci.nsIExternalProtocolService);
    $("a.external").live("click", function (e) {
      e.preventDefault();
      opener.loadUrl(Services.io.newURI($(e.target).attr("href"), "UTF-8", null));
    });

    // Throw the disclaimer into the window.  In the future, this should probably
    // be done in the actual XHTML page, instead of injected via JS.
    let commentary = $(".commentary")
      .append($("<span>" + stringBundle.get("disclaimer",
      ["https://www.mozilla.org/thunderbird/legal/privacy/"]) + "</span>"));

    EmailAccountProvisioner.tryToPopulateProviderList();

    // Link the keypress function to the name field so that we can enable and
    // disable the search button.
    $("#name").keyup(EmailAccountProvisioner.onSearchInputOrProvidersChanged);

    // If we have a name stored in local storage from an earlier session,
    // populate the search field with it.
    let name = EmailAccountProvisioner.storage.getItem("name") ||
               $("#name").text();
    if (!name) {
      try {
        let userInfo = Cc["@mozilla.org/userinfo;1"].getService(Ci.nsIUserInfo);
        name = userInfo.fullname;
      } catch(e) {
        // nsIUserInfo may not be implemented on all platforms, and name might
        // not be avaialble even if it is.
      }
    }
    $("#name").val(name);
    EmailAccountProvisioner.saveName();

    // Pretend like we've typed something into the search input to set the
    // initial enabled/disabled state of the search button.
    EmailAccountProvisioner.onSearchInputOrProvidersChanged();

    $("#window").css("height", window.innerHeight - 1);

    $("button.existing").click(function() {
      EmailAccountProvisioner.saveName();
      EmailAccountProvisioner.NewMailAccount(EmailAccountProvisioner.msgWindow,
                                             null,
                                             window.arguments[0]);
      window.close();
    });

    // Handle Ctrl-W and Esc
    $(window).keypress(function(event) {
      if ((event.which == "119" && isAccel(event))
          || event.keyCode == 27) {
        window.close();
      }
    });

    $("#search").submit(EmailAccountProvisioner.onSearchSubmit);

    $("#notifications").delegate("button.create", "click",
                                 EmailAccountProvisioner.onAddressSelected);

    // Handle clicking on both email address suggestions, as well
    // as the headers for the providers of those suggestions.
    $("#results").delegate("div.selection", "click", function() {
      let self = $(this);
      let resultsGroup = self.closest(".resultsGroup");

      // Return if we're already expanded
      if (resultsGroup.hasClass("expanded"))
        return;

      resultsGroup.siblings().removeClass("expanded");
      resultsGroup.addClass("expanded");

      // Hide the other boxes.
      resultsGroup.siblings().children(".extra").slideUp();
      resultsGroup.siblings().find(".more").show();
      resultsGroup.siblings().find(".pricing").fadeOut("fast");
      resultsGroup.siblings().find(".price").fadeIn("fast");

      // And show this box.
      resultsGroup.find(".more").hide();
      resultsGroup.children().find(".pricing").fadeIn("fast");
      resultsGroup.children().find(".price").fadeOut("fast");
      self.siblings(".extra").slideDown();
    });

    $("button.close").click(function() {
      window.close();
    });

    $(window).unload(function() {
      if (window.arguments[0].search_engine
          && $("#search_engine_check").prop("checked")) {
        let engine = Services.search.getEngineByName(window.arguments[0].search_engine);
        Services.search.currentEngine = engine;
      }
    });

    if (window.arguments[0].success) {
      // Show the success page which lets a user compose mail, find add-ons,
      // set a signature, etc.
      gLog.info("Looks like we just finished ordering an address - showing the success page...");
      EmailAccountProvisioner.showSuccessPage();
    } else {
      // The default mode, where we display the search input, providers, etc
      $("#window").show();
      $("#successful_account").hide();
    }

    gLog.info("Email Account Provisioner init complete.");

    EmailAccountProvisioner._inited = true;
  },

  /**
   * Event handler for when the user submits the search request for their
   * name to the suggestFromName service.
   */
  onSearchSubmit: function EAP_onSearchSubmit() {
    $("#notifications").children().hide();
    $("#instructions").fadeOut();
    EmailAccountProvisioner.saveName();
    // Here's where we do some kind of hack-y client-side sanitization.
    // Believe it or not, this is how you sanitize stuff to HTML elements
    // via jQuery.
    let name = String.trim($("<div></div>").text($("#name").val()).html());
    if (name.length <= 0) {
      $("#name").select().focus();
      return;
    }

    EmailAccountProvisioner.searchEnabled(false);
    EmailAccountProvisioner.spinning(true);
    let [firstname, lastname] = splitName(name);
    let providerList = $(".provider input:checked").map(function() {
      return $(this).val();
    }).get().join(',');

    $.ajax({
      url: EmailAccountProvisioner.suggestFromName,
      dataType: 'json',
      data: {"first_name": firstname,
             "last_name": lastname,
             "providers": providerList,
             "version": 2},
      timeout: CONNECTION_TIMEOUT,
      success: EmailAccountProvisioner.onSearchResults})
      .error(EmailAccountProvisioner.showSearchError)
      .complete(function() {
        $("#FirstAndLastName").html(String.trim(firstname + " " + lastname));
        EmailAccountProvisioner.searchEnabled(true);
        EmailAccountProvisioner.spinning(false);
      });
  },

  /**
   * Event handler for when the user selects an address by clicking on
   * the price button for that address.  This function spawns the content
   * tab for the address order form, and then closes the Account Provisioner
   * window.
   */
  onAddressSelected: function EAP_onAddressSelected() {
    gLog.info("An address was selected by the user.");
    let provider = EmailAccountProvisioner.providers[$(this).data("provider")];

    // Replace the variables in the url.
    let url = provider.api;
    let [firstName, lastName] = splitName(String.trim($("#name").val()));
    let email = $(this).attr("address");
    url = url.replace("{firstname}", firstName);
    url = url.replace("{lastname}", lastName);
    url = url.replace("{email}", email);

    // And add the extra data.
    let data = storedData[provider.id];
    delete data.provider;
    for (let name in data) {
      url += (url.indexOf("?") == -1 ? "?" : "&") +
              name + "=" + encodeURIComponent(data[name]);
    }

    gLog.info("Opening up a contentTab with the order form.");
    // Then open a content tab.
    let mail3Pane = Services.wm.getMostRecentWindow("mail:3pane");

    let tabmail = mail3Pane.document.getElementById("tabmail");
    tabmail.openTab("accountProvisionerTab", {
      contentPage: url,
      realName: String.trim(firstName + " " + lastName),
      email: email,
      searchEngine: provider.search_engine,
      onLoad: function (aEvent, aBrowser) {
        window.close();
      },
    });

    // Wait for the handler to close us.
    EmailAccountProvisioner.spinning(true);
    EmailAccountProvisioner.searchEnabled(false);
    $("#notifications").children().not(".spinner").hide();
  },

  /**
   * Attempt to fetch the provider list from the server.  If it fails,
   * display an error message, and queue for retry.
   */
  tryToPopulateProviderList: function EAP_tryToPopulateProviderList() {
    // If we're already in the middle of getting the provider list, or
    // we already got it before, bail out.
    if (this._loadingProviders || this._loadedProviders)
      return;

    gLog.info("Trying to populate provider list...");

    // If there's a timeout ID for waking the account provisioner, clear it.
    if (this._loadProviderRetryId) {
      window.clearTimeout(this._loadProviderRetryId)
      this._loadProviderRetryId = null;
    }

    var self = this;

    self.searchEnabled(false);
    self.spinning(true);

    let providerListUrl = Services.prefs.getCharPref("mail.provider.providerList");

    $.ajax({
      url: providerListUrl,
      dataType: 'json',
      data: '',
      timeout: CONNECTION_TIMEOUT,
      success: EmailAccountProvisioner.populateProviderList,
      }).error(function() {
        // Ugh, we couldn't get the JSON file.  Maybe we're not online.  Or maybe
        // the server is down, or the file isn't being served.  Regardless, if
        // we get here, none of this stuff is going to work.
        EmailAccountProvisioner._loadProviderRetryId = window.setTimeout(EmailAccountProvisioner.tryToPopulateProviderList
                                                                                                .bind(self),
                                                                         RETRY_TIMEOUT);
        EmailAccountProvisioner._loadingProviders = false;
        EmailAccountProvisioner.beOffline();
        gLog.error("Something went wrong loading the provider list JSON file. "
                   + "Going into offline mode.");
      }).complete(function() {
        EmailAccountProvisioner._loadingProviders = false;
        EmailAccountProvisioner.spinning(false);
        gLog.info("Got provider list JSON.");
      });

    EmailAccountProvisioner._loadingProviders = true;
    gLog.info("We've kicked off a request for the provider list JSON file...");
  },

  providerHasCorrectFields: function EAP_providerHasCorrectFields(provider) {
    let result = true;

    let required = ["id", "label", "paid", "languages", "api", "tos_url",
                    "privacy_url"];

    for (let [index, aField] in Iterator(required)) {
      let fieldExists = (aField in provider);
      result &= fieldExists;

      if (!fieldExists)
        gLog.error("A provider did not have the field " + aField
                   + ", and will be skipped.");
    };

    return result;
  },

  /**
   * Take the fetched providers, create checkboxes, icons and labels,
   * and insert them below the search input.
   */
  populateProviderList: function EAP_populateProviderList(data) {
    gLog.info("Populating the provider list");

    if (!data || !data.length) {
      gLog.error("The provider list we got back from the server was empty!");
      EmailAccountProvisioner.beOffline();
      return;
    }

    let providerList = $("#providerList");
    let otherLangProviders = [];

    EmailAccountProvisioner.providers = {};

    data.forEach(function(provider) {

      if (!(EmailAccountProvisioner.providerHasCorrectFields(provider))) {
        gLog.error("A provider had incorrect fields, and has been skipped");
        return;
      }

      EmailAccountProvisioner.providers[provider.id] = provider;

      // Let's go through the array of languages for this provider, and
      // check to see if at least one of them matches general.useragent.locale.
      // If so, we'll show / select this provider by default.
      let supportsSomeUserLang = provider
                                 .languages
                                 .some(function (x) {
                                   return x == "*" ||
                                          x == EmailAccountProvisioner.userLanguage
                                 });

      let checkboxId = provider.id + "-check";

      let providerCheckbox = $('<input type="checkbox" />')
                             .val(provider.id)
                             .addClass("providerCheckbox")
                             .attr("id", checkboxId);

      let providerEntry = $('<li class="provider" />')
                          .append(providerCheckbox);

      let labelSpan = $('<label class="providerLabel" />')
                      .append(provider.label)
                      .appendTo(providerEntry)
                      .attr("for", checkboxId);

      if (provider.icon)
        providerCheckbox.after('<img class="icon" src="' + provider.icon + '"/>');

      providerCheckbox.change(function() {
        EmailAccountProvisioner.populateTermsAndPrivacyLinks();
      });

      if (supportsSomeUserLang) {
        providerCheckbox.attr('checked', 'checked');
        providerEntry.css('display', 'inline-block');
        providerList.append(providerEntry);
      }
      else {
        providerEntry.addClass("otherLanguage");
        otherLangProviders.push(providerEntry);
      }
    });

    for each (let [i, provider] in Iterator(otherLangProviders)) {
      providerList.append(provider);
    };

    if (otherLangProviders.length) {
      $("#otherLangDesc").fadeIn();
      $("#otherLangDesc").click(function() {
        $("#otherLangDesc").fadeOut();
        $(".otherLanguage").fadeIn().css("display", "inline-block");
      });
    }

    EmailAccountProvisioner.populateTermsAndPrivacyLinks();
    EmailAccountProvisioner.beOnline();
    EmailAccountProvisioner._loadedProviders = true;
    EmailAccountProvisioner.onSearchInputOrProvidersChanged();
  },

  /**
   * Go through each of the checked providers, and add the appropriate
   * ToS and privacy links to the disclaimer.
   */
  populateTermsAndPrivacyLinks: function EAP_populateTOSandPrivacyLinks() {
    gLog.info("Refreshing terms and privacy links");
    // Empty the Terms of Service and Privacy links placeholder.
    let commentary = $(".commentary");
    let placeholder = commentary.find(".placeholder");
    placeholder.empty();

    let selectedProviders = $(".provider input:checked");

    EmailAccountProvisioner.someProvidersChecked = selectedProviders.length > 0;

    let termsAndPrivacyLinks = [];
    selectedProviders.each(function(i, checkbox) {
      let providerId = $(checkbox).val();
      let provider = EmailAccountProvisioner.providers[providerId];
      let providerLinks = $("<span />").text(provider.label + " (")
        .append($("<a />")
          .attr("href", provider.privacy_url)
          .text(stringBundle.get("privacyPolicy"))
          .addClass("privacy").addClass("external").addClass(provider.id)
        )
        .append($("<span />").text(stringBundle.get("sepComma")))
        .append($("<a />")
          .attr("href", provider.tos_url)
          .text(stringBundle.get("tos"))
          .addClass("tos").addClass("external").addClass(provider.id)
        ).append($("<span />").text(")"));
      termsAndPrivacyLinks.push(providerLinks);
    });

    if (termsAndPrivacyLinks.length <= 0) {
      // Something went really wrong - we shouldn't have gotten here. Bail out.
      return;
    } else if (termsAndPrivacyLinks.length == 1) {
      placeholder.append(termsAndPrivacyLinks[0]);
      return;
    } else {
      // Pop off the last terms and privacy links...
      let lastTermsAndPrivacyLink = termsAndPrivacyLinks.pop();
      // Join the remaining terms and privacy links with the comma separator...
      $(termsAndPrivacyLinks).each(function(i, termsAndPrivacyLink) {
        placeholder.append(termsAndPrivacyLink);
        if (i < termsAndPrivacyLinks.length - 1)
          placeholder.append($("<span />").text(stringBundle.get("sepComma")));
      });
      placeholder.append($("<span />").text(stringBundle.get("sepAnd")));
      placeholder.append(lastTermsAndPrivacyLink);
    }
  },

  /**
   * Make the search pane a little bit taller, and the existing account
   * pane a little bit shorter.
   */
  expandSearchPane: function() {
    // Don't expand twice.
    if ($("#existing").data("expanded"))
      return;

    $("#existing").animate({"height": "50px",
                            "font-size": "10pt"}, "fast",
      function() {
        $("#providers").fadeIn();
        $("#content .description").fadeIn();
        $("#existing .header").hide();
        $(".tinyheader .title").css({"opacity": "1.0"}).fadeIn("fast");
        $("#existing").data("expanded", true);
      });
  },

  /**
   * Something went wrong during search.  Show a generic error.  In the future,
   * we might want to show something a bit more descriptive.
   */
  showSearchError: function() {
    $("#notifications").children().hide();
    $("#notifications .error").fadeIn();
  },

  /**
   * Once we've received search results from the server, create some
   * elements to display those results, and inject them into the DOM.
   */
  onSearchResults: function(data) {
    gLog.info("Got back search results");
    // Expand the search pane if it hasn't been expanded yet.
    EmailAccountProvisioner.expandSearchPane();

    // Empty any old results.
    let results = $("#results").empty();

    if (!data || !data.length) {
      // If we've gotten back nonsense, display the generic
      // error message, and bail out.
      gLog.error("We got nothing back from the server for search results!");
      EmailAccountProvisioner.showSearchError();
      return;
    }

    // Get a list of the providers that the user checked - we'll
    // check against these to make sure the server didn't send any
    // back from a provider that the user did not select.
    let selectedProviders = $(".provider input:checked").map(function() {
      return $(this).val();
    });

    // Filter out any results that don't match our requirements...
    let returnedProviders = data.filter(function(aResult) {
      // We require that the search succeeded for a provider, that we
      // got at least one result, and that the provider is actually in
      // the list of providers that we care about.
      let providerInList = (aResult.provider in EmailAccountProvisioner.providers);

      if (!providerInList)
        gLog.error("Got a result back for a provider that was not "
                   + "in the original providerList: " + aResult.provider);

      let providerSelected = $.inArray(aResult.provider, selectedProviders) != -1;

      if (!providerSelected)
        gLog.error("Got a result back for a provider that the user did "
                   + "not select: " + aResult.provider);

      return (aResult.succeeded
              && aResult.addresses.length > 0
              && providerInList
              && providerSelected);
    });

    if (returnedProviders.length == 0) {
      gLog.info("There weren't any results for the selected providers.");
      // Display the generic error message, and bail out.
      EmailAccountProvisioner.showSearchError();
      return;
    }

    for each (let [i, provider] in Iterator(returnedProviders)) {
      let group = $("<div class='resultsGroup'></div>");
      let header = $("#resultsHeader")
                   .clone()
                   .removeClass("displayNone")
                   .addClass("selection");

      header.children(".provider")
            .text(EmailAccountProvisioner.providers[provider.provider].label);

      if (provider.price && provider.price != "0")
        header.children(".price").text(provider.price);
      else
        header.children(".price").text(stringBundle.get("free"));

      group.append(header);

      let renderedAddresses = 0;

      for each (let [j, address] in Iterator(provider.addresses)) {
        let tmplData = {
          address: address,
        };
        if (address.address)
          tmplData.address = address.address;

        // Figure out the price to display on the address button, as so:
        // If there is a per-address price of > 0, use that.
        // Otherwise, if there is a per-address price of 0, use "Free",
        // Otherwise, there's no per-address price,
        //   so if the provider's price is > 0, use that.
        //   Or if the provider's price is 0, use "Free".
        if (address.price && address.price != "0")
          tmplData.priceStr = stringBundle.get("price", [address.price])
        else if (address.price && address.price == "0")
          tmplData.priceStr = stringBundle.get("free");
        else if (provider.price && provider.price != "0")
          tmplData.priceStr = stringBundle.get("price", [provider.price])
        else
          tmplData.priceStr = stringBundle.get("free");

        try {
          let result = $("#result_tmpl").render(tmplData).appendTo(group);
          // If we got here, then we were able to successfully render the
          // address - we'll keep a count of the rendered addresses for the
          // "More" buttons, etc.
          renderedAddresses++;

          if (j >= MAX_SMALL_ADDRESSES)
            result.addClass("extra").hide();

        } catch(e) {
          // An address was returned from the server that we jQuery templates
          // can't render properly.  We'll ignore that address.
          gLog.error("We got back an address that we couldn't render - more detail in the Error Console.");
          Cu.reportError(e);
        }
      }

      if (renderedAddresses > MAX_SMALL_ADDRESSES) {
        let more = renderedAddresses - MAX_SMALL_ADDRESSES;
        let last = group.children(".row:nth-child(" + (MAX_SMALL_ADDRESSES + 1) + ")");
        let tmplData = {
          moreStr: PluralForm.get(more, stringBundle.get("moreOptions")).replace("#1", more),
        };
        $("#more_results_tmpl").render(tmplData).appendTo(last);
      }
      group.find("button.create").data("provider", provider.provider);
      group.append($("#resultsFooter").clone().removeClass("displayNone"));
      results.append(group);
    }

    $("#notifications").children().hide();
    $("#notifications .success").show();

    for each (let [i, provider] in Iterator(data)) {
      delete provider.succeeded
      delete provider.addresses
      delete provider.price
      storedData[provider.provider] = provider;
    }
  },

  /**
   * If we cannot retrieve the provider list from the server, display a
   * message about connection problems, and disable the search fields.
   */
  beOffline: function EAP_beOffline() {
    let offlineMsg = stringBundle.get("cannotConnect");
    $('#cannotConnectMessage').text(offlineMsg).show();
    this.searchEnabled(false);
    gLog.info("Email Account Provisioner is in offline mode.");
  },

  /**
   * If we're suddenly able to get the provider list, hide the connection
   * error message and re-enable the search fields.
   */
  beOnline: function EAP_beOnline() {
    $('#cannotConnectMessage').hide().text('');
    this.searchEnabled(true);
    gLog.info("Email Account Provisioner is in online mode.");
  }
}


XPCOMUtils.defineLazyGetter(EmailAccountProvisioner, "storage", function() {
  return getLocalStorage("accountProvisioner");
});

window.addEventListener("online",
                        EmailAccountProvisioner.tryToPopulateProviderList);

$(EmailAccountProvisioner.init);
