require(['/js/config.js'], function() {
  require(['jsPDF', 'jquery', 'bootstrap', 'html2canvas', 'common', 'moment', 'daterangepicker', 'multiselect', 'chart1'], function() {

    //***todo add chromecast features
    var $body = $('body');
    var $view = $('#view');
    var sections = ['main', 'history', 'demand'];

    var mainData = null;
    var charts = {};

    var userData = localStorage.getItem('auth');
    window.defaultCarrier = JSON.parse(userData).defaultCarrier || 'SA';

    var chartConfig = {
      animation: false,
      barShowStroke: false,
      tooltipTitleFontFamily: "'Titillium Web',sans-serif",
      tooltipFontStyle: "600",
      tooltipFontFamily: "'Titillium Web',sans-serif",
      tooltipTitleFontStyle: "600",
      scaleFontFamily: "'Titillium Web',sans-serif",
      scaleFontStyle: "700",
      responsive: true,
      maintainAspectRatio: true,
      tooltipFillColor: "rgba(0,0,0,0.8)",
      multiTooltipTemplate: "<%= datasetLabel %> - <%= value %>"
    };

    retrieveProperties(function(properties) {
      mainData = properties.dashboards;
      populate(properties.dashboards);

      for (var i in mainData) {
        if (mainData[i].style) {
          if (mainData[i].style == "Fixed") {} else {
            mainData[i].sd = updateDate(mainData[i].soffset);
            mainData[i].ed = updateDate(mainData[i].eoffset);
            var searchString = mainData[i].from + '/' + mainData[i].to + '/' + mainData[i].sd + '/' + mainData[i].ed;
            mainData[i].url = '//api1.webjet.com/metashopper/rs/airdata/trends/' + searchString + '/0';
          }
        }
        addPanel(mainData[i]);
      }
    });

    function populate(data) {
      var htmls = {
        main: '',
        history: '',
        demand: ''
      };
      var cnts = {
        main: 0,
        history: 0,
        demand: 0
      };
      for (var i in data) {
        var section = data[i].type;
        cnts[section] += 1;
        data[i].show = data[i].show || false;
        data[i].id = section + 'Chart' + i;
        data[i].index = i;
        htmls[section] += '<a href="#" class="list-group-item item"><span class="panel-controls" data-index="' + i + '">' +
          '<span class="glyphicon glyphicon-eye-open ' + (data[i].show ? 'active' : '') + '"></span> ' +
          '<span class="pc-display">' + data[i].name + '</span></span>' + ' <span class="panel-controls" data-index="' + i + '">' +
          '<span class="glyphicon glyphicon-remove pull-right pc-remove"></span></span></a>';
      }
      for (var i in sections) {
        $('#' + sections[i] + '-toggle').html(htmls[sections[i]]);
        $('.' + sections[i] + '-toggle .badge').html(cnts[sections[i]]);
      }
    }

    function addPanel(data) {
      if (!data.show) {
        return false;
      }
      var type = data.type;
      var controls = '<span class="pull-right panel-controls" data-index="' + data.index + '">' +
        ' <span class="glyphicon glyphicon-remove pc-remove"></span>' +
        ' <span class="glyphicon glyphicon-eye-open pc-display active"></span>' +
        ' <span class="glyphicon glyphicon glyphicon-resize-full pc-fullwidth ' +
        (data.fullwidth ? 'active' : '') + '"></span>' +
        '</span>';
      var $template = $('#panelTemplate').clone();
      if (data.fullwidth) {
        $template.removeClass('col-md-6');
      }
      $template.removeClass('hidden').attr('id', data.id);
      $template.find('.panel-title').html(data.name + controls);
      $template.find('.panel-body .legend').html(getLegend(data));
      $template.find('.panel-body .wrap-chart').html(
        '<div class="col-sm-8"><canvas style="width: 100%;height: auto;" class="main-chart"></canvas></div>' +
        '<div class="col-sm-4">' +
        '<div class="single-bar">' +
        '<div class="progress">' +
        '<div class="progress-bar progress-bar-success" role="progressbar"></div>' +
        '<div class="progress-bar progress-bar-warning" role="progressbar"></div>' +
        '<div class="progress-bar progress-bar-danger" role="progressbar"></div>' +
        '</div>' +
        '</div>' +
        '<div class="threshold-table"></div>' +
        '</div>' +
        '<div class="col-sm-12">' +
        '<div class="panel-footer" id="main-graph-legend" style="display:none;"></div>' +
        '</div>'
      );
      $view.append($template);
      addChart(data, type);
    }

    function getLegend(data) {
      var fields = ['od', 'from', 'to', 'sd', 'ed', 'minThreshold', 'maxThreshold'];
      var fieldsMap = {
        sd: 'Start date',
        ed: 'End date',
        od: 'Outbound date',
        to: 'Destination',
        from: 'Origin',
        maxThreshold: 'Max threshold',
        minThreshold: 'Min threshold'
      };
      var html = '';
      if (window.defaultCarrier) {
        html += '<span class="carrier_' + data.id + '">Default carrier: <strong>' + window.defaultCarrier.toUpperCase() + ' </strong></span>'
      }
      for (var i in fields) {
        if (data.hasOwnProperty(fields[i])) {
          html += '<span id="' + fields[i] + '">' + fieldsMap[fields[i]] + ': <strong>' + data[fields[i]] + ' </strong></span>'
        }
      }

      return html;
    }

    var thirtyMins = 1800000;

    function addChart(data) {
      var type = data.type;
      var token = JSON.parse(localStorage.getItem('auth')) || {};
      if (token['token']) {
        token = token['token']
      } else {
        token = ''
      }

      var $preloader = $('#' + data.id).find('.data-loading');
      $preloader.removeClass('hidden');
      var $legend = $('#' + data.id).find('#main-graph-legend');
      $legend.hide(0);

      var $headerLegend = $('#' + data.id).find('.panel-body .legend');
      // $headerLegend.hide(0);

      $.ajax({
        url: data.url,
        method: 'GET',
        dataType: 'json',
        headers: {
          'X-MSOTA-SESSION': token,
          'Content-Type': 'application/json'
        },
        success: function(d) {
          switch (type) {
            case 'main':
              mainChart(d, data);
              break;
            case 'history':
              historyChart(d, data);
              break;
            case 'demand':
              demandChart(d, data);
              break;
          }
          $preloader.addClass('hidden');
          sliderToLegend($headerLegend, Object.keys(d.data).length, data);

          //refresh each 60 sec
          setTimeout(function() {
            addChart(data);
          }, thirtyMins);
        },
        error: function(error) {
          $preloader.addClass('hidden');
          if (error.status == 401) {
            localStorage.removeItem('auth');
            location.pathname = '/login'
          }
          console.warn(error);
        }
      });
    }

    function mainChart(d, options) {
      var canvas = $('#' + options.id + ' .main-chart')[0];
      var ctx = canvas.getContext('2d');

      // var canvasD = $('#' + options.id + ' .doughnut-chart')[0];
      // var ctxD = canvasD.getContext('2d');

      var $legend = $('#' + options.id).find('#main-graph-legend');
      $legend.show();

      airlineFilters = options.group;

      if (airlineFilters && airlineFilters.indexOf('all') === -1) {
        var newData = {};
        for (var i in d.data) {
          if (airlineFilters.indexOf(i) !== -1) {
            newData[i] = d.data[i];
          }
        }
        //replace original data
        d.data = newData;
      }

      var labels = d.labels;
      var airlines = Object.keys(d.data);
      var dc = airlines.splice(airlines.indexOf(window.defaultCarrier), 1);
      dc = dc[0];
      airlines.splice(0, 0, dc);
      for (var i in d.data) {
        var vals = getVals2(d.data[i]);
        var sum = vals.reduce(function(pv, cv) {
          return pv + cv;
        }, 0);
        if (!sum) {
          delete d.data[i];
        }
      }
      if (!Object.keys(d.data).length) {
        console.log('empty data');
        return false;
      }

      var datasets = [];

      var token = JSON.parse(localStorage.getItem('auth')) || {};
      var defaultCarrierColor = token.defaultCarrierColor;

      var thresholdData = {
        min: [],
        max: []
      };
      var thresholdChartData = {
        min: 0,
        max: 0,
        mid: 0
      };
      var pointBorderColor = "#fff";
      airlines.forEach(function(airline) {
        var colors;
        if (!d.data.hasOwnProperty(airline)) {
          return true;
        }
        if (airline.toUpperCase() == window.defaultCarrier) {
          // colors = ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0.5)', 'rgb(0, 0, 0)'];
          colors = [defaultCarrierColor, defaultCarrierColor, defaultCarrierColor];
        } else {
          colors = randColors();
        }
        var data = [];
        for (var i = 0; i < labels.length; i++) {
          var val = d.data[airline][labels[i]].value;
          val = val || null;
          data.push(val);
          if (val === null) {
            continue;
          }

          if (dc && airline != dc) {
            var dcData = d.data[dc][labels[i]].value || null;
            if (dcData === null) {
              continue;
            }
            var diff = Math.round(val - dcData);
            if (options.hasOwnProperty('maxThreshold') && options.maxThreshold !== null && options.maxThreshold <= diff) {
              thresholdData.max.push({
                airline: airline,
                label: labels[i],
                value: val,
                diff: diff
              });
              thresholdChartData.max++;
              pointBorderColor = "#F7464A";
            } else if (options.hasOwnProperty('minThreshold') && options.minThreshold !== null && (-1 * options.minThreshold >= diff)) {
              thresholdData.min.push({
                airline: airline,
                label: labels[i],
                value: val,
                diff: diff
              });
              thresholdChartData.min++;
              pointBorderColor = "#46BFBD";
            } else {
              thresholdChartData.mid++;
              pointBorderColor = "#FDB45C";
            }
          }
        }

        datasets.push({
          label: airline,
          data: data,
          // fillColor: colors[1],
          fillColor: 'rgba(0,0,0,0)',
          strokeColor: colors[0],
          pointStrokeColor: pointBorderColor,
          pointHighlightFill: "#fff",
          pointHighlightStroke: colors[2],
          pointColor: colors[2]
        });
      });
      var chartData = {
        labels: labels,
        datasets: datasets
      };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      charts[options.id] = new Chart(ctx).Line(chartData, chartConfig);
      $('#' + options.id).find('#main-graph-legend').html(charts[options.id].generateLegend());
      //doughnut chart
      var doughnutChartData = [{
        value: thresholdChartData.min,
        color: "#46BFBD",
        highlight: "#5AD3D1",
        label: "MIN"
      }, {
        value: thresholdChartData.mid,
        color: "#FDB45C",
        highlight: "#FFC870",
        label: "MID"
      }, {
        value: thresholdChartData.max,
        color: "#F7464A",
        highlight: "#FF5A5E",
        label: "MAX"
      }];
      // var doughnutChart = new Chart(ctxD).Doughnut(doughnutChartData, {
      //     animation: false,
      //     responsive: true,
      //     maintainAspectRatio: true
      // });

      var totalThreshold = thresholdChartData.min + thresholdChartData.mid + thresholdChartData.max;
      var proMin = thresholdChartData.min * 100 / totalThreshold;
      var proMid = thresholdChartData.mid * 100 / totalThreshold;
      var proMax = thresholdChartData.max * 100 / totalThreshold;

      var singleBar = $('#' + options.id + ' .progress')[0];
      var singleBarMin = $(singleBar).find('.progress-bar-success');
      var singleBarMid = $(singleBar).find('.progress-bar-warning');
      var singleBarMax = $(singleBar).find('.progress-bar-danger');
      $(singleBarMin).width(proMin + "%");
      $(singleBarMid).width(proMid + "%");
      $(singleBarMax).width(proMax + "%");
      $(singleBarMin).tooltip({
        title: "MIN: " + thresholdChartData.min
      });
      $(singleBarMid).tooltip({
        title: "MID: " + thresholdChartData.mid
      });
      $(singleBarMax).tooltip({
        title: "MAX: " + thresholdChartData.max
      });
      buildTable(options.id, thresholdData);
      fixTableHeight(canvas);
      saveGraphDate(d, options.id);
    }

    function historyChart(d, options) {
      mainChart(d, options);
    }

    function demandChart(d, options) {

      var canvas = $('#' + options.id + ' .main-chart')[0];
      var ctx = canvas.getContext('2d');

      // var canvasD = $('#' + options.id + ' .doughnut-chart')[0];
      // var ctxD = canvasD.getContext('2d');

      if (!Object.keys(d.data).length) {
        console.log('empty data');
        return false;
      }

      var datasets = [];
      var colors = randColors();
      // datasets.push({
      //     data: d.data,
      //     fillColor: colors[1],
      //     strokeColor: colors[0],
      //     pointStrokeColor: "#fff",
      //     pointHighlightFill: "#fff",
      //     pointHighlightStroke: colors[2],
      //     pointColor: colors[2]
      // });
      // var chartData = {
      //     labels: d.labels,
      //     datasets: datasets
      // };
      // ctx.clearRect(0, 0, canvas.width, canvas.height);
      // charts[options.id] = new Chart(ctx).Line(chartData, chartConfig);

      //build doughnut chart
      var pointBorderColor = "#fff";
      var thresholdData = {
        min: [],
        max: []
      };
      var thresholdChartData = {
        min: 0,
        max: 0,
        mid: 0
      };
      for (var i in d.data) {
        var val = d.data[i];
        if (val === null) {
          continue;
        }
        if (options.hasOwnProperty('maxThreshold') && options.maxThreshold !== null && options.maxThreshold <= val) {
          thresholdData.max.push({
            label: i,
            value: val
          });
          thresholdChartData.max++;
          pointBorderColor = "#F7464A";
        } else if (options.hasOwnProperty('minThreshold') && options.minThreshold !== null && options.minThreshold >= val) {
          thresholdData.min.push({
            label: i,
            value: val
          });
          thresholdChartData.min++;
          pointBorderColor = "#46BFBD";
        } else {
          thresholdChartData.mid++;
          pointBorderColor = "#FDB45C";
        }

        datasets.push({
          data: d.data,
          // fillColor: colors[1],
          fillColor: 'rgba(0,0,0,0)',
          strokeColor: colors[0],
          pointStrokeColor: pointBorderColor,
          pointHighlightFill: "#fff",
          pointHighlightStroke: colors[2],
          pointColor: colors[2]
        });
      }

      var chartData = {
        labels: d.labels,
        datasets: datasets
      };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      charts[options.id] = new Chart(ctx).Line(chartData, chartConfig);

      var doughnutChartData = [{
        value: thresholdChartData.min,
        color: "#46BFBD",
        highlight: "#5AD3D1",
        label: "MIN"
      }, {
        value: thresholdChartData.mid,
        color: "#FDB45C",
        highlight: "#FFC870",
        label: "MID"
      }, {
        value: thresholdChartData.max,
        color: "#F7464A",
        highlight: "#FF5A5E",
        label: "MAX"
      }];
      // var doughnutChart = new Chart(ctxD).Doughnut(doughnutChartData, {
      //     animation: false,
      //     responsive: true,
      //     maintainAspectRatio: true
      // });

      var totalThreshold = thresholdChartData.min + thresholdChartData.mid + thresholdChartData.max;
      var proMin = thresholdChartData.min * 100 / totalThreshold;
      var proMid = thresholdChartData.mid * 100 / totalThreshold;
      var proMax = thresholdChartData.max * 100 / totalThreshold;

      var singleBar = $('#' + options.id + ' .progress')[0];
      var singleBarMin = $(singleBar).find('.progress-bar-success');
      var singleBarMid = $(singleBar).find('.progress-bar-warning');
      var singleBarMax = $(singleBar).find('.progress-bar-danger');
      $(singleBarMin).width(proMin + "%");
      $(singleBarMid).width(proMid + "%");
      $(singleBarMax).width(proMax + "%");
      $(singleBarMin).tooltip({
        title: "MIN: " + thresholdChartData.min
      });
      $(singleBarMid).tooltip({
        title: "MID: " + thresholdChartData.mid
      });
      $(singleBarMax).tooltip({
        title: "MAX: " + thresholdChartData.max
      });
      buildTable(options.id, thresholdData, true);
      fixTableHeight(canvas);
      saveGraphDate(d, options.id);
    }

    function getVals2(obj) {
      var values = [];
      for (var i in obj) {
        var val = obj[i].value ? obj[i].value : 0;
        values.push(val);
      }
      return values;
    }

    function getRandColor(brightness) {
      //6 levels of brightness from 0 to 5, 0 being the darkest
      var rgb = [Math.random() * 128, Math.random() * 256, Math.random() * 256];
      var mix = [brightness * 51, brightness * 51, brightness * 51]; //51 => 255/5
      var mixedrgb = [(Math.random() * 128) + rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function(x) {
        return Math.round(x / 2.0);
      });

      return mixedrgb.join(",");
    }

    function randColors() {
      var mixedrgb = getRandColor(0);
      return ["rgb(" + mixedrgb + ")", "rgba(" + mixedrgb + ",0.2)", "rgba(" + mixedrgb + ", 1)"];
    }

    function saveData(dashboards) {
      var properties = JSON.parse(localStorage.getItem('properties'));
      properties.dashboards = dashboards;
      localStorage.setItem('properties', JSON.stringify(properties));

      saveOrUpdateProperty('dashboards', dashboards, function(property) {
        mainData = property.value;
        populate(property.value);
      });
    }

    function buildTable(id, thresholdData, demand) {
      demand = demand || false;
      var $container = $('#' + id + ' .threshold-table');
      var table = '<table class="table table-hover table-striped table-condensed">';
      table += '<thead><th>#</th>' +
        (!demand ? '<th>Airline</th>' : '') +
        '<th>Label</th>' +
        '<th>Diff</th>' +
        '<th>Value</th></thead>';

      for (var i in thresholdData.min) {
        var item = thresholdData.min[i];
        var row = '<tr class="success">';
        row += '<td>' + (parseInt(i) + 1) + '</td>' +
          (!demand ? '<td>' + item.airline + '</td>' : '') +
          '<td>' + item.label + '</td>' +
          '<td>' + item.diff + '</td>' +
          '<td>' + item.value + '</td>';
        row += '</tr>';
        table += row;
      }

      for (var j in thresholdData.max) {
        var item = thresholdData.max[j];
        var row = '<tr class="danger">';
        row += '<td>' + (parseInt(j) + 1) + '</td>' +
          (!demand ? '<td>' + item.airline + '</td>' : '') +
          '<td>' + item.label + '</td>' +
          '<td>' + item.diff + '</td>' +
          '<td>' + item.value + '</td>';
        row += '</tr>';
        table += row;
      }

      table += '</table>';
      if (i || j) {
        $container.html(table);
      }
    }

    function fixTableHeight(canvas) {
      var canvasHeight = $(canvas).height() - 40;
      var canvasWrapper = $(canvas).parent().parent();
      $(canvasWrapper).find(".threshold-table").css("max-height", canvasHeight);
    }

    function saveGraphDate(d, id) {
      var data = d;
      var saveId = id;
      localStorage.setItem(saveId, JSON.stringify(data));
    }

    window.updateChart = function(obj) {
      var slider = obj;
      var chartId = $(slider).attr('id');
      var splitId = chartId.split("_");

      var graphData = JSON.parse(localStorage.getItem(splitId[1]) || '[]');
      var queryData = {};

      var properties = detectProperties();
      var mainData = properties.dashboards;
      var i = 0;

      for (i in mainData) {
        if (mainData[i].id == splitId[1]) {
          queryData = mainData[i];
          break;
        }
      }

      if (!queryData['id']) {
        queryData['id'] = splitId[1];
      }

      switch (splitId[0]) {
        case "min":
          queryData.minThreshold = slider.value;
          mainData[i].minThreshold = slider.value;
          $('#minth-' + splitId[1]).val(slider.value);
          break;
        case "max":
          queryData.maxThreshold = slider.value;
          mainData[i].maxThreshold = slider.value;
          $('#maxth-' + splitId[1]).val(slider.value);
          break;
        default:
          break;
      }
      if (splitId[1].indexOf("demand") >= 0) {
        demandChart(graphData, queryData);
      } else {
        mainChart(graphData, queryData);
      }

      saveData(mainData);
    }

    function sliderToLegend(targetLegend, maxValue, data) {
      var legend = targetLegend;
      var maxLimit = maxValue;
      var sliderMinId = 'min_' + data.id;
      var sliderMaxId = 'max_' + data.id;
      var currentMinValue = data['minThreshold'];
      var currentMaxValue = data['maxThreshold'];

      if (currentMinValue == null) {
        currentMinValue = 0;
      }
      if (currentMaxValue === null) {
        currentMaxValue = 0;
      }

      var minThres = $(legend).find('#minThreshold');
      var maxThres = $(legend).find('#maxThreshold');
      $(minThres).empty();
      $(maxThres).empty();

      $(minThres).append(
        '<span>MinThreshold:<input type="text" id="minth-' + data.id + '" class="thval" style="width:70px;margin-left: 10px;font-size:11px;" value="' + currentMinValue + '"/></span><input class="single-slider" id="' + sliderMinId + '" type="hidden" value="' + currentMinValue + '" oninput="updateChart(this)" onchange="updateChart(this)"/>'
      );
      $(maxThres).append(
        '<span>MaxThreshold:<input type="text" id="maxth-' + data.id + '" class="thval" style="width:70px;margin-left: 10px;font-size:11px;" value="' + currentMaxValue + '"/></span><input class="single-slider" id="' + sliderMaxId + '" type="hidden" value="' + currentMaxValue + '" oninput="updateChart(this)" onchange="updateChart(this)"/>'
      );

      $('#' + sliderMinId).jRange({
        from: 0,
        to: 2000,
        step: 1,
        format: '%s',
        width: 300,
        showLabels: true,
        snap: true
      });
      $('#' + sliderMaxId).jRange({
        from: 0,
        to: 2000,
        step: 1,
        format: '%s',
        width: 300,
        showLabels: true,
        snap: true
      });
    }

    $('.list-group-item').on('click', function() {
      $('.list-group-item', this)
        .toggleClass('glyphicon-chevron-right')
        .toggleClass('glyphicon-chevron-down');
    });

    $body.on('keyup', '.thval', function(e) {
      if (e.which == 13) {
        var id = $(this).attr('id');
        var chartId = id.split('-')[1];

        var sliderId = null;
        if (id.indexOf('max') != -1) {
          sliderId = 'max_' + chartId;
        } else {
          sliderId = 'min_' + chartId;
        }

        $('#' + sliderId).jRange('setValue', $(this).val());
      }
    });

    $body.on('click', '.pc-display', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var $self = $(this);
      $self.toggleClass('active');
      var $controls = $self.parents('.panel-controls');
      var index = $controls.data('index');
      var data = mainData[index];
      if (!data) {
        return false;
      }
      if ($(this).hasClass('active')) {
        data.show = true;
        addPanel(data);
      } else {
        data.show = false;
        $('#' + data.id).remove();
      }

      mainData[index] = data;
      saveData(mainData);
    });

    $body.on('click', '.pc-fullwidth', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var $self = $(this);
      $self.toggleClass('active');
      var $controls = $self.parents('.panel-controls');
      var index = $controls.data('index');
      var data = mainData[index];
      if (!data) {
        return false;
      }
      if ($(this).hasClass('active')) {
        data.fullwidth = true;
        $self.parents('.panel-template').removeClass('col-md-6');
      } else {
        data.fullwidth = false;
        $self.parents('.panel-template').addClass('col-md-6');
      }

      if (charts.hasOwnProperty(data.id)) {
        charts[data.id]
          //.render(true)
          .resize(); //todo
        //.draw();
      }

      mainData[index] = data;
      saveData(mainData);

    });

    $body.on('click', '.pc-remove', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var $self = $(this);
      var $controls = $self.parents('.panel-controls');
      var index = $controls.data('index');
      var data = mainData[index];
      if (!data) {
        return false;
      }
      var html = '<div class="alert alert-danger alert-dismissible" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">×</span></button>' +
        '<h4>Confirm deleting saved search</h4>' +
        '<p>Are you sure you want to delete saved search "' + data.name + '"</p>' +
        '<p><button type="button" data-dismiss="alert" class="btn btn-danger pc-remove-confirm" data-index="' + index + '">Delete</button></p>' +
        '</div>';
      $('.errorBlock').html(html);
    });

    $body.on('click', '.pc-remove-confirm', function() {
      var index = $(this).data('index');
      var data = mainData[index];
      if (!data) {
        return false;
      }
      $('#' + data.id).remove();
      localStorage.removeItem(data.id);

      var sliceSource = mainData.slice(index + 1);
      mainData.splice(index, 1);
      saveData(mainData);
    });

    $body.on('click', '.list-group-item.item', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var index = $(this).find('.panel-controls').first().data('index');
      $('.list-group-item.item').removeClass('highlight-item');
      $(this).addClass('highlight-item');
      $('.panel-template').removeClass('highlight-panel');
      $('#' + mainData[index].id).addClass('highlight-panel');
    });

    var updateDate = function(diff) {
      var date = new Date();
      date.setDate(date.getDate() + parseInt(diff));

      var month = date.getMonth() + 1;
      if (month < 10) {
        month = '0' + month;
      }

      var day = date.getDate();
      if (day < 10) {
        day = '0' + day;
      }

      return date.getFullYear() + '-' + month + "-" + day;
    };

    $body.on('click', '#logout', function() {
      localStorage.removeItem('auth'); //may be make logout from API
      localStorage.removeItem('properties');
      localStorage.removeItem('saved');
      location.pathname = '/login';
    });

  }); //end

});
