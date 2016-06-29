define(['jquery', 'sweetalert', 'bootstrap'], function() {
  $(function() {

    var version = '1.1';

    //ie 9 fix
    //http://stackoverflow.com/questions/9160123/no-transport-error-w-jquery-ajax-call-in-ie
    $.support.cors = true;


    var loginUrl = '//api1.webjet.com/metashopper/rs/security/authenticate';
    var logoutUrl = '//api1.webjet.com/metashopper/rs/security/logout';
    var propertiesUrl = '//api1.webjet.com/metashopper/rs/identity/user/%id%/properties';
    var propertyUrl = '//api1.webjet.com/metashopper/rs/identity/user/%id%/property';
    var basePath = '';
    var loginPath = basePath + '/login';
    var successRedirect = basePath + '/my/airiq/reports';
    var $body = $('body');

    if (typeof(Storage) === "undefined") {
      alert('can not use localStorage on this device');
    }

    //auto logout
    var lv = localStorage.getItem('version');
    localStorage.setItem('version', version);
    if (lv && lv !== version) {
      location.pathname = loginPath;
    }

    var notSecurePages = [
      basePath + '/login',
      basePath + '/login/',
      basePath + '/login/index.html'
    ];
    var loc = location.pathname;
    if (notSecurePages.indexOf(loc) === -1 && !localStorage.getItem('auth')) {
      location.pathname = loginPath;
    } else {
      $('.page').show();
    }

    $body.on('submit', '#loginForm', function(e) {
      e.preventDefault();
      var loginData = {
        username: $('#inputEmail').val(),
        password: $('#inputPassword').val()
      };
      $.postJSON(loginUrl, JSON.stringify(loginData)).done(function(resp) {
        localStorage.setItem('auth', JSON.stringify(resp));

        $.ajax({
          url: propertiesUrl.replace('%id%', resp.userId),
          method: 'GET',
          dataType: 'json',
          headers: {
            'X-MSOTA-SESSION': resp.token,
            'Content-Type': 'application/json'
          },
          success: function(response) {
            var props = response.properties;

            window.airdata = window.airdata || {};
            window.airdata.properties = props;
            localStorage.setItem('properties', JSON.stringify(props));

            if (Object.keys(props).length) {
              if (props.defaultcarrier) {
                resp.defaultCarrier = props.defaultcarrier;
                resp.defaultCarrierColor = props.defaultCarrierColor;
              }
              if (props.carriergroups) {
                resp.carrierGroups = props.carriergroups;
              }
            }

            /*resp.carrierGroups = { //for testing
                "Group 1":             ["EK", "SQ"],
                "Eric's Test Group":   ["TK", "LH", "SQ"],
                "Group 1 - Tier1":     ["EY", "QR"],
                "Group 2 - Tier1":     ["EK", "EY", "QR"],
                "Group 2 - Tier2":     ["EY", "QR", "LH", "TK"],
                "Group 2 - Tier3":     ["EK", "EY", "QR", "LH", "TK", "VS"],
                "Group 3 - Tier3":     ["LH", "TK", "SQ"]
            };*/

            localStorage.setItem('auth', JSON.stringify(resp));
            location.pathname = successRedirect;
          },
          error: function(error) {
            if (!error.responseText) {
              location.pathname = successRedirect;
            } else {
              error = JSON.parse(error.responseText);
              swal('', error.message, 'warning');
            }
          }
        });

      }).fail(function(error) {
        try {
          error = JSON.parse(error.responseText);
          //swal('', error.message, 'warning');
          showAlert(error.message)
        } catch (e) {
          showAlert(error.responseText);
        }
      });
    });

    $.postJSON = function(url, data, callback) {
      return jQuery.ajax({
        type: 'POST',
        url: url,
        contentType: 'application/json',
        data: data,
        dataType: 'json',
        success: callback
      });
    };

    $.postJSONwithToken = function(url, data, token, callback) {
      return jQuery.ajax({
        type: 'POST',
        url: url,
        contentType: 'application/json',
        data: data,
        dataType: 'json',
        headers: {
          'X-MSOTA-SESSION': token
        },
        success: callback
      });
    };

    function showAlert(text, className) {
      className = className || 'warning';
      var html = '<div class="alert alert-' + className + ' alert-dismissible fade in" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
        '<strong>' + className.toUpperCase() + '!</strong> ' + text +
        '</div>';
      var $eb = $('.errorBlock');
      if ($eb.length > 1) {
        var page = window.searchParams.page;
        page = page == 'index' ? 'main' : page;
        $('#' + page + ' .errorBlock').html(html);
      } else {
        $('.errorBlock').html(html);
      }
    }

    function dayDiff(ends) {
      var startDate = new Date();
      var endDate = new Date(Date.parse(ends));
      return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    function dayDiffNum(ends) {
      var startDate = new Date();
      var endDate = new Date(Date.parse(ends));
      return (endDate - startDate);
    }

    function detectAuth() {
      var auth = window.airdata ? window.airdata.auth : null;
      if (typeof auth == 'undefined' || !auth) {
        auth = JSON.parse(localStorage.getItem('auth'));
        (window.airdata || {}).auth = auth;
      }
      return auth;
    }
    window.detectAuth = detectAuth;

    function retrieveProperties(callbackFn, errorCallbackFn) {
      var auth = detectAuth();

      $.ajax({
        url: propertiesUrl.replace(/%id%/gi, auth.userId),
        method: 'GET',
        dataType: 'json',
        headers: {
          'X-MSOTA-SESSION': auth.token,
          'Content-Type': 'application/json'
        },
        success: function(response) {
          (window.airdata || {}).properties = response.properties;
          localStorage.setItem('properties', JSON.stringify(response.properties));
          (callbackFn || noop)(response.properties);
        },
        error: function(error) {
          (errorCallbackFn || noop)(error);
        }
      });
    }
    window.retrieveProperties = retrieveProperties;

    function detectProperties() {
      var properties = window.airdata && window.airdata.properties ? window.airdata.properties : null;
      if (properties == null) {
        properties = JSON.parse(localStorage.getItem('properties'));
        (window.airdata || {}).properties = properties;
      }

      return properties;
    }
    window.detectProperties = detectProperties;

    function saveOrUpdateProperty(key, value, callbackFn, errorCallbackFn) {
      var auth = detectAuth();

      var property = {
        property: key,
        value: value
      };

      $.ajax({
        url: propertyUrl.replace(/%id%/gi, auth.userId),
        method: 'PUT',
        data: JSON.stringify(property),
        dataType: 'json',
        crossDomain: true,
        xhrFields: {
          withCredentials: true
        },
        contentType: 'application/json',
        headers: {
          'X-MSOTA-SESSION': auth.token
        },
        success: function(response) {
          (callbackFn || noop)(response);
        },
        error: function(error) {
          (errorCallbackFn || noop)(error);
        }
      });
    };
    window.saveOrUpdateProperty = saveOrUpdateProperty;

    function saveSearch(data) {
      page = 'saved';
      var savedData = localStorage.getItem(page);
      if (savedData) {
        savedData = JSON.parse(savedData);
      } else {
        savedData = [];
      }

      if (data.type == 'main') {
        if (data.style == 'Fixed') {
          data.name = 'Fixed: ' + data.sd + '~' + data.ed;
        } else {
          data.name = 'Relative: ' + dayDiff(data.sd) + 'days out ~' + dayDiff(data.ed) + 'days out';
          data.soffset = dayDiff(data.sd);
          data.eoffset = dayDiff(data.ed);
        }
      } else {
        data.name = page + ' ' + data.time;
      }

      savedData.push(data);
      localStorage.setItem(page, JSON.stringify(savedData));

      var dashboards = [];
      var properties = detectProperties();
      if (properties && properties['dashboards']) {
        dashboards = window.airdata.properties['dashboards'];
      }

      dashboards.push(data);
      saveOrUpdateProperty('dashboards', dashboards, retrieveProperties);

      if (data.type == 'main') {
        if (data.style == 'Fixed') {
          showAlert('This search was saved as <a href="../dashboard">"' + 'Fixed: ' + data.sd + '~' + data.ed + '"</a>', 'info');
        } else {
          showAlert('This search was saved as <a href="../dashboard">"' + 'Relative: ' + dayDiff(data.sd) + 'days out -' + dayDiff(data.ed) + 'days out' + '"</a>', 'info');
        }
      } else {
        showAlert('This search was saved as <a href="../dashboard">"' + data.name + '"</a>', 'info');
      }

    }

    window.saveSearch = saveSearch;
    window.showAlert = showAlert;

  });

  //ie fix
  if (!window.console) {
    window.console = {
      log: function() {},
      warn: function() {},
      error: function() {}
    }
  }

  var noop = function() {};

});
